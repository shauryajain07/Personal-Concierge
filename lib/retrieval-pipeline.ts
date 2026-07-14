import { codexJson, retrievalPlanSchema } from "./codex";
import {
  fallbackRetrievalPlan,
  getCompactAcademicIndex,
  sanitizeRetrievalPlan,
  selectRetrievalPlannerHistory,
  type CompactAcademicIndex,
  type ConversationMessage,
  type RetrievalIntent,
  type RetrievalPlan,
} from "./retrieval";

type RetrievalPlannerInput = {
  schema: Record<string, unknown>;
  system: string;
  prompt: string;
};

export type RetrievalPlannerCall = (input: RetrievalPlannerInput) => Promise<RetrievalPlan | null>;

export async function planAcademicRetrieval({
  userId,
  latestMessage,
  history,
  now = new Date(),
  forcedIntent,
  plannerCall,
  codexSessionId = null,
}: {
  userId: string;
  latestMessage: string;
  history: ConversationMessage[];
  now?: Date;
  forcedIntent?: RetrievalIntent;
  plannerCall?: RetrievalPlannerCall;
  codexSessionId?: string | null;
}) {
  const { index, timezone } = getCompactAcademicIndex(userId, now);
  const plannerHistory = selectRetrievalPlannerHistory(history, latestMessage);
  const fallback = () => fallbackRetrievalPlan({ latestMessage, history, index, now, forcedIntent });
  let rawPlan: RetrievalPlan | null = null;
  let usedFallback = false;

  try {
    const input: RetrievalPlannerInput = {
      schema: retrievalPlanSchema,
      system: [
        "Plan the smallest safe academic-data retrieval needed to answer the latest student request.",
        "Return only IDs present in the compact index. Never invent IDs.",
        "The compact index is metadata only; request notes, grades, history, assignments, and dates only when relevant.",
        "Use conversationMessageCount to retain the fewest supplied recent messages needed to resolve a follow-up.",
        "Use includeGrades only for grades, progress, performance, or prioritization.",
        "Use includeHistoricalSemesters only for explicit historical, prerequisite, trend, or long-term degree questions.",
        "For scheduling, infer a bounded affected date range.",
      ].join(" "),
      prompt: [
        `Current date: ${now.toISOString()}`,
        `Timezone: ${timezone}`,
        `Latest user message: ${latestMessage}`,
        `Recent follow-up context available: ${JSON.stringify(plannerHistory)}`,
        `Compact academic index: ${JSON.stringify(index)}`,
      ].join("\n\n"),
    };
    rawPlan = plannerCall ? await plannerCall(input) : await codexJson<RetrievalPlan>({ ...input, sessionId: codexSessionId });
  } catch {
    usedFallback = true;
  }

  if (!rawPlan) {
    rawPlan = fallback();
    usedFallback = true;
  }
  if (forcedIntent) rawPlan = { ...rawPlan, intent: forcedIntent };
  const plan = sanitizeRetrievalPlan(rawPlan, index, now, plannerHistory.length);
  const deterministicMatches = fallback();
  plan.courseIds = [...new Set([...plan.courseIds, ...deterministicMatches.courseIds])].slice(0, 20);
  plan.assignmentIds = [...new Set([...plan.assignmentIds, ...deterministicMatches.assignmentIds])].slice(0, 30);
  const requestText = `${plannerHistory.map((item) => item.text).join(" ")} ${latestMessage}`;
  const historicalRequest = /\b((last|previous|past)\s+(semester|term|year|course)|historical|history|prerequisite|degree plan|four years?|4 years?|all semesters?|over time|trend|changed)\b/i.test(requestText);
  plan.includeHistoricalSemesters = historicalRequest;
  plan.includeGrades = plan.intent === "review_progress" || /\b(grade|gpa|score|performance|standing|progress|prioriti[sz])\b/i.test(requestText);
  if (!plan.noteQuery && deterministicMatches.noteQuery) plan.noteQuery = deterministicMatches.noteQuery;
  const answerHistory = plannerHistory.slice(-plan.conversationMessageCount);
  return { plan, index, timezone, plannerHistory, answerHistory, usedFallback };
}

export function compactIndexContainsNoPrivateBodies(index: CompactAcademicIndex) {
  return index.notes.every((note) => !("content" in note)) && index.assignments.every((assignment) => !("description" in assignment));
}
