import { getDb, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const userId = userIdFromRequest(request); const db = getDb();
  const current = db.prepare("SELECT * FROM tasks WHERE id=? AND user_id=?").get(id, userId) as Record<string, unknown> | undefined;
  if (!current) return Response.json({ error: "Task not found" }, { status: 404 });
  const input = await request.json() as { title?: string; description?: string; dueAt?: string | null; status?: string; priority?: string; estimatedMinutes?: number };
  if (input.dueAt && !Number.isFinite(Date.parse(input.dueAt))) return Response.json({ error: "Task deadline is invalid" }, { status: 400 });
  db.prepare("UPDATE tasks SET title=?,description=?,due_at=?,status=?,priority=?,estimated_minutes=?,updated_at=? WHERE id=? AND user_id=?")
    .run(input.title?.trim() || current.title, input.description ?? current.description, input.dueAt === undefined ? current.due_at : input.dueAt ? new Date(input.dueAt).toISOString() : null, input.status ?? current.status, input.priority ?? current.priority, input.estimatedMinutes ?? current.estimated_minutes, new Date().toISOString(), id, userId);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getDb().prepare("DELETE FROM tasks WHERE id=? AND user_id=?").run(id, userIdFromRequest(request));
  return Response.json({ ok: result.changes > 0 }, { status: result.changes ? 200 : 404 });
}
