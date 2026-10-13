import { randomUUID } from "node:crypto";
import { getDb, ensureUser, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

const categories = new Set(["preference", "goal", "constraint", "other"]);

export async function POST(request: Request) {
  const userId = userIdFromRequest(request);
  ensureUser(userId);
  const input = await request.json() as { title?: string; content?: string; category?: string; enabled?: boolean };
  const title = input.title?.trim().slice(0, 120) || "";
  const content = input.content?.trim().slice(0, 1_500) || "";
  const category = input.category || "preference";
  if (!title || !content) return Response.json({ error: "Add a title and a short memory." }, { status: 400 });
  if (!categories.has(category)) return Response.json({ error: "Choose a valid memory type." }, { status: 400 });

  const id = randomUUID();
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO memories (id,user_id,title,content,category,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, userId, title, content, category, input.enabled === false ? 0 : 1, now, now);
  return Response.json({ id }, { status: 201 });
}
