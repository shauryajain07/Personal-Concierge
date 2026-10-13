import { getDb, userIdFromRequest } from "@/lib/db";
import { clearFocusSessionsForDate, listFocusSessions } from "@/lib/focus-session-store";

export const runtime = "nodejs";

function failure(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Unable to manage calendar focus sessions" }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return Response.json({ sessions: listFocusSessions(userIdFromRequest(request), { date: url.searchParams.get("date"), assignmentId: url.searchParams.get("assignmentId") }) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (!date) return Response.json({ error: "A date is required" }, { status: 400 });
    return Response.json(clearFocusSessionsForDate(userIdFromRequest(request), date));
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const userId = userIdFromRequest(request);
    const input = await request.json() as { id?: string };
    if (!input.id) return Response.json({ error: "A study session id is required" }, { status: 400 });

    const db = getDb();
    const session = db.prepare(
      "SELECT id,assignment_id as assignmentId,start_at as startAt,end_at as endAt,status FROM study_sessions WHERE id=? AND user_id=?",
    ).get(input.id, userId) as { id: string; assignmentId: string; startAt: string; endAt: string; status: string } | undefined;
    if (!session) return Response.json({ error: "Study session not found" }, { status: 404 });
    if (session.status === "completed") return Response.json({ ok: true, status: "completed" });
    if (session.status !== "planned") return Response.json({ error: "Only planned study sessions can be completed" }, { status: 409 });

    const minutes = Math.round((+new Date(session.endAt) - +new Date(session.startAt)) / 60_000);
    if (!Number.isFinite(minutes) || minutes <= 0) return Response.json({ error: "Study session has an invalid duration" }, { status: 400 });
    const complete = db.transaction(() => {
      const result = db.prepare("UPDATE study_sessions SET status='completed' WHERE id=? AND user_id=? AND status='planned'").run(session.id, userId);
      if (result.changes) {
        db.prepare("UPDATE assignments SET actual_minutes=actual_minutes+?,updated_at=? WHERE id=? AND user_id=?")
          .run(minutes, new Date().toISOString(), session.assignmentId, userId);
      }
      return result.changes;
    });
    complete();
    const current = db.prepare("SELECT status FROM study_sessions WHERE id=? AND user_id=?").get(session.id, userId) as { status: string } | undefined;
    if (current?.status !== "completed") return Response.json({ error: "Study session could not be completed" }, { status: 409 });
    return Response.json({ ok: true, status: "completed", minutes });
  } catch (error) { return failure(error); }
}
