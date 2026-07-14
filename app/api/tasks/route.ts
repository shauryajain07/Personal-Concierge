import { randomUUID } from "node:crypto";
import { getDb, seedUser, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = userIdFromRequest(request); seedUser(userId);
  const input = await request.json() as { title?: string; description?: string; dueAt?: string | null; courseId?: string | null; priority?: string; estimatedMinutes?: number };
  if (!input.title?.trim()) return Response.json({ error: "Task title is required" }, { status: 400 });
  if (input.dueAt && !Number.isFinite(Date.parse(input.dueAt))) return Response.json({ error: "Task deadline is invalid" }, { status: 400 });
  const id = randomUUID();
  getDb().prepare("INSERT INTO tasks (id,user_id,course_id,title,description,due_at,status,priority,estimated_minutes) VALUES (?,?,?,?,?,?,'pending',?,?)")
    .run(id, userId, input.courseId || null, input.title.trim(), input.description || "", input.dueAt ? new Date(input.dueAt).toISOString() : null, input.priority || "medium", Math.max(5, input.estimatedMinutes || 30));
  return Response.json({ id }, { status: 201 });
}
