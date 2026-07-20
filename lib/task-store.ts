import { randomUUID } from "node:crypto";
import { getDb, seedUser } from "./db";
import type { Task } from "./types";

export type TaskQuery = {
  query?: string | null;
  status?: "pending" | "completed" | null;
  courseId?: string | null;
  limit?: number;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  courseId?: string | null;
  status?: "pending" | "completed";
  priority?: "low" | "medium" | "high";
  estimatedMinutes?: number;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export class TaskStoreError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const taskColumns = "id,course_id as courseId,title,description,due_at as dueAt,status,priority,estimated_minutes as estimatedMinutes,created_at as createdAt,updated_at as updatedAt";

function taskRow(userId: string, id: string) {
  return getDb().prepare(`SELECT ${taskColumns} FROM tasks WHERE id=? AND user_id=?`).get(id, userId) as Task | undefined;
}

function validDate(value: string | null | undefined) {
  return value === null || value === undefined || Number.isFinite(Date.parse(value));
}

function validateCourse(userId: string, courseId: string | null | undefined) {
  if (!courseId) return null;
  const course = getDb().prepare("SELECT id FROM courses WHERE id=? AND user_id=?").get(courseId, userId);
  if (!course) throw new TaskStoreError("Course not found", 400);
  return courseId;
}

export function listTasks(userId: string, filters: TaskQuery = {}) {
  seedUser(userId);
  const clauses = ["user_id=?"];
  const values: Array<string | number> = [userId];
  if (filters.status) { clauses.push("status=?"); values.push(filters.status); }
  if (filters.courseId) { clauses.push("course_id=?"); values.push(filters.courseId); }
  if (filters.query?.trim()) {
    clauses.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
    const escaped = filters.query.trim().replace(/[\\%_]/g, "\\$&");
    values.push(`%${escaped}%`, `%${escaped}%`);
  }
  const requestedLimit = Number.isFinite(filters.limit) ? filters.limit! : 50;
  const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit)));
  values.push(limit);
  return getDb().prepare(`SELECT ${taskColumns} FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY status, due_at IS NULL, due_at, created_at DESC LIMIT ?`).all(...values) as Task[];
}

export function getTask(userId: string, id: string) {
  seedUser(userId);
  const task = taskRow(userId, id);
  if (!task) throw new TaskStoreError("Task not found", 404);
  return task;
}

export function createTask(userId: string, input: CreateTaskInput) {
  seedUser(userId);
  const title = input.title?.trim();
  if (!title) throw new TaskStoreError("Task title is required", 400);
  if (!validDate(input.dueAt)) throw new TaskStoreError("Task deadline is invalid", 400);
  const status = input.status || "pending";
  const priority = input.priority || "medium";
  if (!["pending", "completed"].includes(status)) throw new TaskStoreError("Task status is invalid", 400);
  if (!["low", "medium", "high"].includes(priority)) throw new TaskStoreError("Task priority is invalid", 400);
  const id = randomUUID();
  const dueAt = input.dueAt ? new Date(input.dueAt).toISOString() : null;
  const courseId = validateCourse(userId, input.courseId);
  const estimatedMinutes = Math.max(5, Math.trunc(input.estimatedMinutes || 30));
  getDb().prepare("INSERT INTO tasks (id,user_id,course_id,title,description,due_at,status,priority,estimated_minutes) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, userId, courseId, title, input.description || "", dueAt, status, priority, estimatedMinutes);
  return getTask(userId, id);
}

export function updateTask(userId: string, id: string, input: UpdateTaskInput) {
  const current = getTask(userId, id);
  if (input.title !== undefined && !input.title.trim()) throw new TaskStoreError("Task title is required", 400);
  if (!validDate(input.dueAt)) throw new TaskStoreError("Task deadline is invalid", 400);
  if (input.status !== undefined && !["pending", "completed"].includes(input.status)) throw new TaskStoreError("Task status is invalid", 400);
  if (input.priority !== undefined && !["low", "medium", "high"].includes(input.priority)) throw new TaskStoreError("Task priority is invalid", 400);
  const courseId = input.courseId === undefined ? current.courseId : validateCourse(userId, input.courseId);
  const dueAt = input.dueAt === undefined ? current.dueAt : input.dueAt ? new Date(input.dueAt).toISOString() : null;
  const estimatedMinutes = input.estimatedMinutes === undefined ? current.estimatedMinutes : Math.max(5, Math.trunc(input.estimatedMinutes));
  getDb().prepare("UPDATE tasks SET course_id=?,title=?,description=?,due_at=?,status=?,priority=?,estimated_minutes=?,updated_at=? WHERE id=? AND user_id=?")
    .run(courseId, input.title?.trim() || current.title, input.description === undefined ? current.description : input.description || "", dueAt, input.status || current.status, input.priority || current.priority, estimatedMinutes, new Date().toISOString(), id, userId);
  return getTask(userId, id);
}

export function deleteTask(userId: string, id: string) {
  const current = getTask(userId, id);
  getDb().prepare("DELETE FROM tasks WHERE id=? AND user_id=?").run(id, userId);
  return { id, title: current.title, deleted: true as const };
}
