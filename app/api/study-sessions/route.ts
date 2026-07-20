import { userIdFromRequest } from "@/lib/db";
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
