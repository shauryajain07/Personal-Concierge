import { randomUUID } from "node:crypto";
import { academicAnswerSchema, codexJson, getCodexAuthStatus } from "@/lib/codex";
import { codexSessionIdFromRequest } from "@/lib/codex-auth";
import { userIdFromRequest } from "@/lib/db";
import {
  buildRetrievalMetadata,
  retrieveAcademicContext,
  toScheduleData,
  type ConversationMessage,
  type RetrievalIntent,
} from "@/lib/retrieval";
import { planAcademicRetrieval } from "@/lib/retrieval-pipeline";
import { buildSchedule } from "@/lib/scheduler";
import { applyWorkspaceActions, looksLikeWorkspaceCommand, planWorkspaceActions } from "@/lib/workspace-actions";

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

export async function POST(request: Request) {
  try {
    const userId = userIdFromRequest(request);
    const codexSessionId = codexSessionIdFromRequest(request);
    const body = (await request.json()) as { message?: string; history?: ConversationMessage[] };
    const message = body.message?.trim();
    if (!message) return Response.json({ error: "Tell Alma what changed" }, { status: 400 });
    const auth = await getCodexAuthStatus(codexSessionId);
    if (!auth.connected) {
      return Response.json({ error: "Login with ChatGPT to use Alma AI.", code: "CHATGPT_LOGIN_REQUIRED" }, { status: 401 });
    }
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const now = new Date();
    if (codexSessionId && looksLikeWorkspaceCommand(message)) {
      const actionPlan = await planWorkspaceActions({ userId, message, history, now, codexSessionId });
      if (actionPlan?.needsClarification) {
        return Response.json({ planId: randomUUID(), action: "clarification", intent: "answer", message: actionPlan.message, changes: [], atRisk: [], appliedActions: [], aiUsed: true });
      }
      if (actionPlan?.actions.length) {
        const appliedActions = applyWorkspaceActions(userId, actionPlan.actions);
        return Response.json({
          planId: randomUUID(), action: "workspace_update", intent: "answer",
          message: actionPlan.message || `${appliedActions.map((item) => item.summary).join("; ")}.`,
          changes: [], atRisk: [], appliedActions, aiUsed: true,
        });
      }
    }
    const complexRequest = /\b(schedule|reschedule|rebuild|plan my|move|lighter|heavier|study block|study session|free my|evening|grade|gpa|score|performance|progress|trend|standing|prioriti[sz]|historical|history|prerequisite|degree plan|semester|assignment brief|analy[sz]e)\b/i.test(`${message} ${history.map((item) => item.text).join(" ")}`);

    const retrieval = await planAcademicRetrieval({ userId, latestMessage: message, history, now, codexSessionId, fastPath: !complexRequest });
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
    if (!answer) throw new Error("Alma could not get a response from Codex. Please try again.");
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
