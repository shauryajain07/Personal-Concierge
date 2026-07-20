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
import { applyWorkspaceActions, looksLikeWorkspaceCommand, planWorkspaceActions, runTaskTools } from "@/lib/workspace-actions";

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
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const now = new Date();
    if (codexSessionId && looksLikeWorkspaceCommand(message)) {
      try {
        const taskResult = await runTaskTools({ userId, message, history, now, codexSessionId });
        if (taskResult?.handled) {
          return Response.json({
            planId: randomUUID(),
            action: taskResult.needsClarification ? "clarification" : "workspace_update",
            intent: "answer",
            message: taskResult.message,
            changes: [],
            atRisk: [],
            appliedActions: taskResult.changed ? [{ kind: "task_tool", summary: taskResult.message }] : [],
            aiUsed: true,
          });
        }
      } catch {
        // Keep the existing structured-action path as a fallback if task tools
        // cannot start, while assignments and events continue to use it normally.
      }
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
    const complexRequest = /\b(schedule|reschedule|rebuild|plan my|move|shift|spread|redistribute|clear up|clear my|lighter|heavier|study block|study session|free my|evening|grade|gpa|score|performance|progress|trend|standing|prioriti[sz]|historical|history|prerequisite|degree plan|semester|assignment brief|analy[sz]e)\b/i.test(`${message} ${history.map((item) => item.text).join(" ")}`);

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
          "Act as an autonomous but reversible planning assistant: when enough context exists to make a safe proposal, make the best reasonable assumptions instead of asking the student for suggestions or preferences.",
          "Evaluate urgency, deadlines, priority, remaining effort, daily workload, fixed commitments, existing study sessions, and the student's saved daily capacity before proposing a schedule.",
          "For rebuild_schedule, return only retrieved assignment IDs in focusAssignmentIds and translate explicit or safely inferred time preferences into the scheduling fields.",
          "If the student asks to clear or lighten a day, redistribute that day's flexible academic work across suitable later days while protecting deadlines, avoiding conflicts, preventing overload, and preserving reasonable breaks and evening time where possible.",
          "Use the profile's saved maxDailyMinutes as the default dailyLimitMinutes when the student does not provide a limit. Use sensible defaults for other scheduling fields rather than asking, unless a missing fact makes every safe plan impossible.",
          "In the response message, briefly state the planning rationale, the assumptions made, and what the proposed plan is intended to change. Present it as a proposal the student can accept or adjust; do not claim that it has already been applied or invent exact times not present in the generated changes.",
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
