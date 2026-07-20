import { getDb, seedUser } from "./db";
import type { StudySession } from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const sessionColumns = "id,assignment_id as assignmentId,subtask_id as subtaskId,title,start_at as startAt,end_at as endAt,status,plan_id as planId";

export function istDayRange(date: string) {
  if (!DATE_PATTERN.test(date)) throw new Error("Date must use YYYY-MM-DD format");
  const start = new Date(`${date}T00:00:00+05:30`);
  if (!Number.isFinite(+start)) throw new Error("Date is invalid");
  const end = new Date(+start + 86_400_000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function listFocusSessions(userId: string, options: { date?: string | null; assignmentId?: string | null } = {}) {
  seedUser(userId);
  const clauses = ["user_id=?"];
  const values: string[] = [userId];
  if (options.date) {
    const range = istDayRange(options.date);
    clauses.push("start_at<?", "end_at>?");
    values.push(range.endAt, range.startAt);
  }
  if (options.assignmentId) { clauses.push("assignment_id=?"); values.push(options.assignmentId); }
  return getDb().prepare(`SELECT ${sessionColumns} FROM study_sessions WHERE ${clauses.join(" AND ")} ORDER BY start_at`).all(...values) as StudySession[];
}

export function clearFocusSessionsForDate(userId: string, date: string) {
  seedUser(userId);
  const range = istDayRange(date);
  const sessions = listFocusSessions(userId, { date }).filter((session) => session.status === "planned");
  const result = getDb().prepare("DELETE FROM study_sessions WHERE user_id=? AND status='planned' AND start_at<? AND end_at>?")
    .run(userId, range.endAt, range.startAt);
  return { date, deleted: result.changes, sessions: sessions.map(({ id, assignmentId, title, startAt, endAt }) => ({ id, assignmentId, title, startAt, endAt })) };
}
