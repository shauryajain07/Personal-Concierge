import { userIdFromRequest } from "@/lib/db";
import { deleteTask, getTask, TaskStoreError, updateTask, type UpdateTaskInput } from "@/lib/task-store";

export const runtime = "nodejs";

function failure(error: unknown) {
  const known = error instanceof TaskStoreError;
  return Response.json({ error: known ? error.message : "Unable to manage task" }, { status: known ? error.status : 500 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json({ task: getTask(userIdFromRequest(request), (await params).id) }); }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const task = updateTask(userIdFromRequest(request), (await params).id, await request.json() as UpdateTaskInput);
    return Response.json({ task });
  } catch (error) { return failure(error); }
}

export const PUT = PATCH;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(deleteTask(userIdFromRequest(request), (await params).id)); }
  catch (error) { return failure(error); }
}
