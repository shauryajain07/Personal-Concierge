import { randomUUID } from "node:crypto";
import { academicAnswerSchema, codexJson, getCodexAuthStatus } from "@/lib/codex";
import { codexSessionIdFromRequest } from "@/lib/codex-auth";
import { userIdFromRequest } from "@/lib/db";
import {
  buildRetrievalMetadata,
  retrieveAcademicContext,
  toScheduleData,
  type ConversationMessage,
  type RetrievedAcademicContext,
  type RetrievalIntent,
} from "@/lib/retrieval";
import { planAcademicRetrieval } from "@/lib/retrieval-pipeline";
import { buildSchedule } from "@/lib/scheduler";

export const runtime = "nodejs";

type AcademicAnswer = {
  intent: RetrievalIntent;
  message: string;
  focusAssignmentIds: string[];
  dailyLimitMinutes: number | null;
  earliestStartHour: number | null;
  latestEndHour: number | null;
  preferredSessionMinutes: number | null;
};

function deterministicAnswer(intent: RetrievalIntent, context: RetrievedAcademicContext): AcademicAnswer {
  const upcoming = context.assignments.filter((assignment) => assignment.status !== "completed");
  let message = "I found the relevant current-term records, but Codex is unavailable right now.";
  if (intent === "rebuild_schedule") {
    message = upcoming.length
      ? `I built a bounded plan for ${upcoming.length} relevant assignment${upcoming.length === 1 ? "" : "s"}.`
      : "There are no incomplete assignments in the selected planning window.";
  } else if (intent === "review_progress" && context.grades.length) {
    const average = context.grades.reduce((sum, grade) => sum + grade.score / grade.maxScore * 100, 0) / context.grades.length;
    message = `Your selected grade records average ${Math.round(average)}%.`;
  } else if (upcoming.length) {
    message = `The closest relevant deadline is ${upcoming[0].title} on ${new Date(upcoming[0].dueAt).toLocaleDateString()}.`;
  }
  return {
    intent,
    message,
    focusAssignmentIds: upcoming.slice(0, 3).map((assignment) => assignment.id),
    dailyLimitMinutes: null,
    earliestStartHour: null,
    latestEndHour: null,
    preferredSessionMinutes: null,
  };
}

export async function POST(request: Request) {
  try {
    const userId = userIdFromRequest(request);
    const codexSessionId = codexSessionIdFromRequest(request);
    const body = (await request.json()) as { message?: string; history?: ConversationMessage[] };
    const message = body.message?.trim();
    if (!message) return Response.json({ error: "Tell Alma what changed" }, { status: 400 });
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const now = new Date();

    const retrieval = await planAcademicRetrieval({ userId, latestMessage: message, history, now, codexSessionId });
    const context = retrieveAcademicContext(userId, retrieval.plan, now);
    let answer: AcademicAnswer | null = null;
    try {
      answer = await codexJson<AcademicAnswer>({
        schema: academicAnswerSchema,
        system: [
          "Answer from only the retrieved academic context supplied below.",
          "Never assume that omitted records do not exist; say when the retrieved context is insufficient.",
          "Never invent record IDs, deadlines, grades, notes, or commitments.",
          "Keep intent equal to the retrieval plan intent.",
          "For rebuild_schedule, return only retrieved assignment IDs in focusAssignmentIds and translate time preferences into the scheduling fields.",
          "For non-scheduling intents, keep scheduling fields null.",
        ].join(" "),
        prompt: [
          `Current date: ${now.toISOString()}`,
          `Timezone: ${retrieval.timezone}`,
          `Latest user message: ${message}`,
          `Minimal conversation context: ${JSON.stringify(retrieval.answerHistory)}`,
          `Retrieval plan: ${JSON.stringify(retrieval.plan)}`,
          `Retrieved academic context: ${JSON.stringify(context)}`,
        ].join("\n\n"),
        sessionId: codexSessionId,
      });
    } catch {
      answer = null;
    }
    answer ||= deterministicAnswer(retrieval.plan.intent, context);
    answer.intent = retrieval.plan.intent;
    const retrievedAssignmentIds = new Set(context.assignments.map((assignment) => assignment.id));
    answer.focusAssignmentIds = [...new Set(answer.focusAssignmentIds)].filter((id) => retrievedAssignmentIds.has(id));

    const changes = answer.intent === "rebuild_schedule"
      ? buildSchedule(toScheduleData(context), {
          focusIds: answer.focusAssignmentIds,
          dailyLimitMinutes: answer.dailyLimitMinutes || undefined,
          earliestStartHour: answer.earliestStartHour || undefined,
          latestEndHour: answer.latestEndHour || undefined,
          preferredSessionMinutes: answer.preferredSessionMinutes || undefined,
          windowStart: context.dateRange.start,
          windowEnd: context.dateRange.end,
        })
      : [];
    const scheduledAssignments = new Set(changes.map((change) => change.assignmentId));
    const atRisk = answer.intent === "rebuild_schedule"
      ? context.assignments
          .filter((assignment) => assignment.status !== "completed" && !scheduledAssignments.has(assignment.id))
          .map((assignment) => assignment.title)
      : [];
    const auth = await getCodexAuthStatus(codexSessionId);
    const response: Record<string, unknown> = {
      planId: randomUUID(),
      action: answer.intent === "rebuild_schedule" ? "rebuild_schedule" : "answer",
      intent: answer.intent,
      message: answer.message,
      changes,
      atRisk,
      aiUsed: auth.connected,
    };
    if (process.env.NODE_ENV !== "production") {
      response.retrieval = {
        ...buildRetrievalMetadata(retrieval.plan, context),
        usedFallback: retrieval.usedFallback,
      };
    }
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to respond" }, { status: 500 });
  }
}
