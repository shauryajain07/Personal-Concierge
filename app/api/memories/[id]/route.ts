import { getDb, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

const categories = new Set(["preference", "goal", "constraint", "other"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = userIdFromRequest(request);
  const input = await request.json() as { title?: string; content?: string; category?: string; enabled?: boolean };
  const current = getDb().prepare("SELECT * FROM memories WHERE id=? AND user_id=?").get(id, userId) as Record<string, unknown> | undefined;
  if (!current) return Response.json({ error: "Memory not found." }, { status: 404 });

  const title = input.title === undefined ? String(current.title) : input.title.trim().slice(0, 120);
  const content = input.content === undefined ? String(current.content) : input.content.trim().slice(0, 1_500);
  const category = input.category === undefined ? String(current.category) : input.category;
  if (!title || !content) return Response.json({ error: "Add a title and a short memory." }, { status: 400 });
  if (!categories.has(category)) return Response.json({ error: "Choose a valid memory type." }, { status: 400 });

  getDb().prepare("UPDATE memories SET title=?,content=?,category=?,enabled=?,updated_at=? WHERE id=? AND user_id=?")
    .run(title, content, category, input.enabled === undefined ? current.enabled : Number(input.enabled), new Date().toISOString(), id, userId);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getDb().prepare("DELETE FROM memories WHERE id=? AND user_id=?").run(id, userIdFromRequest(request));
  return Response.json({ ok: result.changes > 0 });
}
