import { userIdFromRequest } from "@/lib/db";
import { createTask, listTasks, TaskStoreError, type CreateTaskInput } from "@/lib/task-store";

export const runtime = "nodejs";

function failure(error: unknown) {
  const known = error instanceof TaskStoreError;
  return Response.json({ error: known ? error.message : "Unable to manage tasks" }, { status: known ? error.status : 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    if (status && !["pending", "completed"].includes(status)) return Response.json({ error: "Task status is invalid" }, { status: 400 });
    const tasks = listTasks(userIdFromRequest(request), {
      query: url.searchParams.get("query"),
      status: status as "pending" | "completed" | null,
      courseId: url.searchParams.get("courseId"),
      limit: Number(url.searchParams.get("limit") || 50),
    });
    return Response.json({ tasks, count: tasks.length });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const task = createTask(userIdFromRequest(request), await request.json() as CreateTaskInput);
    return Response.json({ task }, { status: 201 });
  } catch (error) { return failure(error); }
}
