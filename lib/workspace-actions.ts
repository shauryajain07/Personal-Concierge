import { randomUUID } from "node:crypto";
import { codexJson, workspaceActionSchema } from "./codex";
import { getAcademicData, getDb, seedUser } from "./db";
import type { ConversationMessage } from "./retrieval";

export type WorkspaceActionKind =
  | "create_assignment" | "update_assignment" | "delete_assignment"
  | "create_task" | "update_task" | "delete_task"
  | "create_event" | "update_event" | "delete_event";

export type WorkspaceAction = {
  kind: WorkspaceActionKind;
  targetId: string | null;
  courseId: string | null;
  title: string | null;
  description: string | null;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  status: string | null;
  priority: string | null;
  estimatedMinutes: number | null;
  progress: number | null;
  eventType: string | null;
};

export type WorkspaceActionPlan = {
  message: string;
  needsClarification: boolean;
  actions: WorkspaceAction[];
};

export type AppliedWorkspaceAction = { kind: WorkspaceActionKind; id: string; summary: string };

export function looksLikeWorkspaceCommand(message: string) {
  return /\b(add|create|make|schedule|book|put|edit|update|change|rename|move|reschedule|delete|remove|cancel|mark|complete|finish|postpone|push)\b/i.test(message)
    && /\b(assignment|task|todo|to-do|event|calendar|class|meeting|appointment|practice|deadline|reminder)\b/i.test(message);
}

export async function planWorkspaceActions({
  userId,
  message,
  history,
  now = new Date(),
  codexSessionId,
}: {
  userId: string;
  message: string;
  history: ConversationMessage[];
  now?: Date;
  codexSessionId: string;
}) {
  const data = getAcademicData(userId);
  const context = {
    timezone: "Asia/Kolkata",
    courses: data.courses.map(({ id, code, name }) => ({ id, code, name })),
    assignments: data.assignments.map(({ id, courseId, title, description, dueAt, status, priority, estimatedMinutes, progress }) => ({ id, courseId, title, description, dueAt, status, priority, estimatedMinutes, progress })),
    tasks: data.tasks.map(({ id, courseId, title, description, dueAt, status, priority, estimatedMinutes }) => ({ id, courseId, title, description, dueAt, status, priority, estimatedMinutes })),
    events: data.events.map(({ id, courseId, title, startAt, endAt, type }) => ({ id, courseId, title, startAt, endAt, type })),
  };
  return codexJson<WorkspaceActionPlan>({
    schema: workspaceActionSchema,
    system: [
      "Translate explicit workspace mutation requests into actions. You may create, update, or delete assignments, standalone tasks, and calendar events.",
      "A task/todo is a standalone small item. An assignment is assessed academic work. A calendar event occupies a start/end time.",
      "Resolve references only to IDs in the supplied context; never invent target or course IDs.",
      "For creates, targetId must be null. For updates/deletes, targetId must exactly match an existing record of that kind.",
      "Only include fields the student explicitly states or that are safe conventional defaults. Use medium priority and 60 estimated minutes for an assignment, and medium priority and 30 minutes for a task, when omitted.",
      "Assignments require title, courseId, and dueAt. Events require title, startAt, and endAt. Tasks require title and may omit a deadline.",
      "Interpret relative dates using the supplied current time and timezone, and return ISO 8601 timestamps with an explicit offset.",
      "For an event with a start but no duration/end, ask a concise clarification instead of acting. Never guess which ambiguous existing record to edit or delete.",
      "If required information is missing or a reference is ambiguous, set needsClarification true, put the question in message, and return no actions.",
      "If the request is not asking to mutate these records, return no actions, needsClarification false, and an empty message.",
      "When actions are present, message should be a short past-tense confirmation suitable to show after they are applied.",
    ].join(" "),
    prompt: [
      `Current time: ${now.toISOString()}`,
      "Timezone: Asia/Kolkata",
      `Recent conversation: ${JSON.stringify(history.slice(-6))}`,
      `Student request: ${message}`,
      `Current workspace records: ${JSON.stringify(context)}`,
    ].join("\n\n"),
    sessionId: codexSessionId,
  });
}

function validDate(value: string | null) {
  return value !== null && Number.isFinite(Date.parse(value));
}

function priority(value: string | null, fallback = "medium") {
  return ["low", "medium", "high"].includes(value || "") ? value! : fallback;
}

function requireOwned(db: ReturnType<typeof getDb>, table: "assignments" | "tasks" | "calendar_events", id: string | null, userId: string) {
  if (!id) throw new Error("Alma could not identify the record to change.");
  const row = db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(id, userId) as Record<string, unknown> | undefined;
  if (!row) throw new Error("That record no longer exists in your workspace.");
  return row;
}

function optionalCourse(db: ReturnType<typeof getDb>, courseId: string | null, userId: string) {
  if (!courseId) return null;
  if (!db.prepare("SELECT id FROM courses WHERE id=? AND user_id=?").get(courseId, userId)) throw new Error("That course is not in your workspace.");
  return courseId;
}

export function applyWorkspaceActions(userId: string, actions: WorkspaceAction[]): AppliedWorkspaceAction[] {
  seedUser(userId);
  const db = getDb();
  if (!Array.isArray(actions) || !actions.length) return [];
  if (actions.length > 10) throw new Error("Please make at most 10 changes at once.");
  return db.transaction(() => actions.map((action) => {
    const id = action.targetId || randomUUID();
    if (action.kind === "create_assignment") {
      if (!action.title?.trim() || !action.courseId || !validDate(action.dueAt)) throw new Error("A new assignment needs a title, course, and valid deadline.");
      optionalCourse(db, action.courseId, userId);
      db.prepare("INSERT INTO assignments (id,user_id,course_id,title,description,due_at,status,priority,estimated_minutes) VALUES (?,?,?,?,?,?,'not_started',?,?)")
        .run(id, userId, action.courseId, action.title.trim(), action.description || "", new Date(action.dueAt!).toISOString(), priority(action.priority), Math.max(15, action.estimatedMinutes || 60));
      return { kind: action.kind, id, summary: `Added assignment “${action.title.trim()}”` };
    }
    if (action.kind === "update_assignment") {
      const current = requireOwned(db, "assignments", action.targetId, userId);
      const dueAt = action.dueAt === null ? current.due_at : validDate(action.dueAt) ? new Date(action.dueAt).toISOString() : (() => { throw new Error("The assignment deadline is invalid."); })();
      const status = ["not_started", "in_progress", "completed"].includes(action.status || "") ? action.status : current.status;
      const progress = action.progress === null ? Number(current.progress) : Math.max(0, Math.min(100, action.progress));
      db.prepare("UPDATE assignments SET course_id=?,title=?,description=?,due_at=?,status=?,priority=?,estimated_minutes=?,progress=?,updated_at=? WHERE id=? AND user_id=?")
        .run(action.courseId === null ? current.course_id : optionalCourse(db, action.courseId, userId), action.title?.trim() || current.title, action.description === null ? current.description : action.description, dueAt, status, priority(action.priority, String(current.priority)), action.estimatedMinutes === null ? current.estimated_minutes : Math.max(15, action.estimatedMinutes), progress, new Date().toISOString(), action.targetId, userId);
      return { kind: action.kind, id: action.targetId!, summary: `Updated assignment “${action.title?.trim() || current.title}”` };
    }
    if (action.kind === "delete_assignment") {
      const current = requireOwned(db, "assignments", action.targetId, userId);
      db.prepare("DELETE FROM assignments WHERE id=? AND user_id=?").run(action.targetId, userId);
      return { kind: action.kind, id: action.targetId!, summary: `Deleted assignment “${current.title}”` };
    }
    if (action.kind === "create_task") {
      if (!action.title?.trim()) throw new Error("A new task needs a title.");
      const dueAt = action.dueAt === null ? null : validDate(action.dueAt) ? new Date(action.dueAt).toISOString() : (() => { throw new Error("The task deadline is invalid."); })();
      db.prepare("INSERT INTO tasks (id,user_id,course_id,title,description,due_at,status,priority,estimated_minutes) VALUES (?,?,?,?,?,?,'pending',?,?)")
        .run(id, userId, optionalCourse(db, action.courseId, userId), action.title.trim(), action.description || "", dueAt, priority(action.priority), Math.max(5, action.estimatedMinutes || 30));
      return { kind: action.kind, id, summary: `Added task “${action.title.trim()}”` };
    }
    if (action.kind === "update_task") {
      const current = requireOwned(db, "tasks", action.targetId, userId);
      const dueAt = action.dueAt === null ? current.due_at : validDate(action.dueAt) ? new Date(action.dueAt).toISOString() : (() => { throw new Error("The task deadline is invalid."); })();
      const status = ["pending", "completed"].includes(action.status || "") ? action.status : current.status;
      db.prepare("UPDATE tasks SET course_id=?,title=?,description=?,due_at=?,status=?,priority=?,estimated_minutes=?,updated_at=? WHERE id=? AND user_id=?")
        .run(action.courseId === null ? current.course_id : optionalCourse(db, action.courseId, userId), action.title?.trim() || current.title, action.description === null ? current.description : action.description, dueAt, status, priority(action.priority, String(current.priority)), action.estimatedMinutes === null ? current.estimated_minutes : Math.max(5, action.estimatedMinutes), new Date().toISOString(), action.targetId, userId);
      return { kind: action.kind, id: action.targetId!, summary: `Updated task “${action.title?.trim() || current.title}”` };
    }
    if (action.kind === "delete_task") {
      const current = requireOwned(db, "tasks", action.targetId, userId);
      db.prepare("DELETE FROM tasks WHERE id=? AND user_id=?").run(action.targetId, userId);
      return { kind: action.kind, id: action.targetId!, summary: `Deleted task “${current.title}”` };
    }
    if (action.kind === "create_event") {
      if (!action.title?.trim() || !validDate(action.startAt) || !validDate(action.endAt) || +new Date(action.endAt!) <= +new Date(action.startAt!)) throw new Error("A new event needs a title and valid start/end time.");
      const type = ["class", "personal", "deadline"].includes(action.eventType || "") ? action.eventType : "personal";
      db.prepare("INSERT INTO calendar_events (id,user_id,course_id,title,start_at,end_at,type,locked) VALUES (?,?,?,?,?,?,?,1)")
        .run(id, userId, optionalCourse(db, action.courseId, userId), action.title.trim(), new Date(action.startAt!).toISOString(), new Date(action.endAt!).toISOString(), type);
      return { kind: action.kind, id, summary: `Added event “${action.title.trim()}”` };
    }
    if (action.kind === "update_event") {
      const current = requireOwned(db, "calendar_events", action.targetId, userId);
      const startAt = action.startAt === null ? String(current.start_at) : validDate(action.startAt) ? new Date(action.startAt).toISOString() : (() => { throw new Error("The event start time is invalid."); })();
      const endAt = action.endAt === null ? String(current.end_at) : validDate(action.endAt) ? new Date(action.endAt).toISOString() : (() => { throw new Error("The event end time is invalid."); })();
      if (+new Date(endAt) <= +new Date(startAt)) throw new Error("Event end time must be after its start time.");
      const type = ["class", "personal", "deadline"].includes(action.eventType || "") ? action.eventType : current.type;
      db.prepare("UPDATE calendar_events SET course_id=?,title=?,start_at=?,end_at=?,type=? WHERE id=? AND user_id=?")
        .run(action.courseId === null ? current.course_id : optionalCourse(db, action.courseId, userId), action.title?.trim() || current.title, startAt, endAt, type, action.targetId, userId);
      return { kind: action.kind, id: action.targetId!, summary: `Updated event “${action.title?.trim() || current.title}”` };
    }
    const current = requireOwned(db, "calendar_events", action.targetId, userId);
    db.prepare("DELETE FROM calendar_events WHERE id=? AND user_id=?").run(action.targetId, userId);
    return { kind: action.kind, id: action.targetId!, summary: `Deleted event “${current.title}”` };
  }))();
}
