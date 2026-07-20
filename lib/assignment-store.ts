import { getDb, seedUser } from "./db";
import type { Assignment } from "./types";

const assignmentColumns = "id,course_id as courseId,title,description,due_at as dueAt,status,priority,estimated_minutes as estimatedMinutes,actual_minutes as actualMinutes,progress,created_at as createdAt";

export function listAssignments(userId: string, query?: string | null, limit = 50) {
  seedUser(userId);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 50;
  if (!query?.trim()) {
    return getDb().prepare(`SELECT ${assignmentColumns} FROM assignments WHERE user_id=? ORDER BY due_at LIMIT ?`).all(userId, safeLimit) as Assignment[];
  }
  const escaped = query.trim().replace(/[\\%_]/g, "\\$&");
  return getDb().prepare(`SELECT ${assignmentColumns} FROM assignments WHERE user_id=? AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') ORDER BY due_at LIMIT ?`)
    .all(userId, `%${escaped}%`, `%${escaped}%`, safeLimit) as Assignment[];
}

export function getAssignment(userId: string, id: string) {
  seedUser(userId);
  const assignment = getDb().prepare(`SELECT ${assignmentColumns} FROM assignments WHERE id=? AND user_id=?`).get(id, userId) as Assignment | undefined;
  if (!assignment) throw new Error("Assignment not found");
  return assignment;
}

export function deleteAssignment(userId: string, id: string) {
  const assignment = getAssignment(userId, id);
  const linkedSessions = getDb().prepare("SELECT COUNT(*) as count FROM study_sessions WHERE user_id=? AND assignment_id=?").get(userId, id) as { count: number };
  getDb().prepare("DELETE FROM assignments WHERE id=? AND user_id=?").run(id, userId);
  return { id, title: assignment.title, deleted: true as const, removedStudySessions: linkedSessions.count };
}
