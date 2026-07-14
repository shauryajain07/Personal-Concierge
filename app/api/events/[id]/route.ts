import { getDb, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const userId = userIdFromRequest(request); const db = getDb();
  const current = db.prepare("SELECT * FROM calendar_events WHERE id=? AND user_id=?").get(id, userId) as Record<string, unknown> | undefined;
  if (!current) return Response.json({ error: "Event not found" }, { status: 404 });
  const input = await request.json() as { title?: string; startAt?: string; endAt?: string; type?: string; courseId?: string | null };
  const startAt = input.startAt ? new Date(input.startAt) : new Date(String(current.start_at));
  const endAt = input.endAt ? new Date(input.endAt) : new Date(String(current.end_at));
  if (!Number.isFinite(+startAt) || !Number.isFinite(+endAt) || +endAt <= +startAt) return Response.json({ error: "End time must be after start time" }, { status: 400 });
  db.prepare("UPDATE calendar_events SET course_id=?,title=?,start_at=?,end_at=?,type=? WHERE id=? AND user_id=?")
    .run(input.courseId === undefined ? current.course_id : input.courseId || null, input.title?.trim() || current.title, startAt.toISOString(), endAt.toISOString(), input.type ?? current.type, id, userId);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getDb().prepare("DELETE FROM calendar_events WHERE id=? AND user_id=?").run(id, userIdFromRequest(request));
  return Response.json({ ok: result.changes > 0 }, { status: result.changes ? 200 : 404 });
}
