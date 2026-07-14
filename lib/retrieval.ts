import type { AcademicData, Assignment, CalendarEvent, Course, Grade, Note, StudySession, Subtask } from "./types";
import { getDb, seedUser } from "./db";

export type RetrievalIntent = "answer" | "analyze_assignment" | "rebuild_schedule" | "review_progress";

export type RetrievalPlan = {
  intent: RetrievalIntent;
  dateRange: { start: string | null; end: string | null };
  courseIds: string[];
  assignmentIds: string[];
  noteQuery: string | null;
  includeGrades: boolean;
  includeHistoricalSemesters: boolean;
  conversationMessageCount: number;
  reason: string;
};

export type ConversationMessage = { role: "user" | "assistant"; text: string };

export type CompactAcademicIndex = {
  currentSemesterId: string | null;
  semesters: Array<{ id: string; name: string; number: number; startDate: string; endDate: string }>;
  courses: Array<{ id: string; semesterId: string; code: string; name: string }>;
  assignments: Array<{ id: string; courseId: string; title: string; status: string; dueAt: string; priority: string }>;
  notes: Array<{ id: string; courseId: string | null; title: string; tags: string[]; updatedAt: string }>;
};

export type RetrievedAcademicContext = {
  profile: {
    timezone: string;
    maxDailyMinutes: number;
    currentSemester: { id: string; name: string; number: number; startDate: string; endDate: string } | null;
  };
  dateRange: { start: string; end: string };
  courses: Course[];
  assignments: Assignment[];
  notes: Note[];
  grades: Grade[];
  events: CalendarEvent[];
  studySessions: StudySession[];
  semesters: AcademicData["semesters"];
};

export type RetrievalMetadata = {
  intent: RetrievalIntent;
  selectedRecordIds: {
    courses: string[];
    assignments: string[];
    notes: string[];
    grades: string[];
    events: string[];
    studySessions: string[];
    semesters: string[];
  };
  dateRange: { start: string; end: string };
  recordCounts: Record<string, number>;
  gradesIncluded: boolean;
  historicalSemestersIncluded: boolean;
  conversationMessageCount: number;
};

export const RETRIEVAL_LIMITS = {
  compactCourses: 100,
  compactAssignments: 300,
  compactNotes: 200,
  courses: 32,
  assignments: 40,
  notes: 6,
  noteCharacters: 2_000,
  assignmentDescriptionCharacters: 1_200,
  grades: 60,
  events: 120,
  studySessions: 120,
  semesters: 16,
  subtasks: 160,
  conversationMessages: 8,
} as const;

type UserProfileRow = { timezone: string; maxDailyMinutes: number };

function placeholders(values: readonly unknown[]) {
  return values.map(() => "?").join(",");
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function currentSemester(userId: string, now: Date) {
  const date = now.toISOString().slice(0, 10);
  return getDb().prepare(
    "SELECT id,name,number,start_date as startDate,end_date as endDate FROM semesters WHERE user_id=? AND start_date<=? AND end_date>=? ORDER BY number DESC LIMIT 1",
  ).get(userId, date, date) as RetrievedAcademicContext["profile"]["currentSemester"] | undefined;
}

export function getCompactAcademicIndex(userId: string, now = new Date()): { index: CompactAcademicIndex; timezone: string } {
  seedUser(userId);
  const db = getDb();
  const profile = db.prepare("SELECT timezone,max_daily_minutes as maxDailyMinutes FROM users WHERE id=?").get(userId) as UserProfileRow;
  const semesterRows = db.prepare(
    "SELECT id,name,number,start_date as startDate,end_date as endDate FROM semesters WHERE user_id=? ORDER BY number LIMIT ?",
  ).all(userId, RETRIEVAL_LIMITS.semesters) as CompactAcademicIndex["semesters"];
  const courseRows = db.prepare(
    "SELECT id,semester_id as semesterId,code,name FROM courses WHERE user_id=? ORDER BY created_at LIMIT ?",
  ).all(userId, RETRIEVAL_LIMITS.compactCourses) as CompactAcademicIndex["courses"];
  const assignmentRows = db.prepare(
    "SELECT id,course_id as courseId,title,status,due_at as dueAt,priority FROM assignments WHERE user_id=? ORDER BY due_at LIMIT ?",
  ).all(userId, RETRIEVAL_LIMITS.compactAssignments) as CompactAcademicIndex["assignments"];
  const noteRows = db.prepare(
    "SELECT id,course_id as courseId,title,tags,updated_at as updatedAt FROM notes WHERE user_id=? ORDER BY pinned DESC,updated_at DESC LIMIT ?",
  ).all(userId, RETRIEVAL_LIMITS.compactNotes) as Array<Omit<CompactAcademicIndex["notes"][number], "tags"> & { tags: string }>;
  const current = currentSemester(userId, now);
  return {
    timezone: profile.timezone,
    index: {
      currentSemesterId: current?.id || null,
      semesters: semesterRows,
      courses: courseRows,
      assignments: assignmentRows,
      notes: noteRows.map((note) => ({ ...note, tags: parseTags(note.tags) })),
    },
  };
}

const FOLLOW_UP_PATTERN = /\b(that|those|it|them|earlier|previous|same|again|after that|make it|make that|lighter|heavier|move it|adjust|what about|how about|instead|also|continue|why|can you)\b/i;

export function selectRetrievalPlannerHistory(history: ConversationMessage[], latestMessage: string) {
  // A thread is the student's working context. Keep a tiny tail for new turns,
  // and a larger tail when the message explicitly refers back to prior work.
  const limit = FOLLOW_UP_PATTERN.test(latestMessage) ? RETRIEVAL_LIMITS.conversationMessages : 4;
  return history
    .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.text === "string")
    .slice(-limit)
    .map((item) => ({ role: item.role, text: item.text.slice(0, 1_500) }));
}

function mentions(text: string, ...candidates: Array<string | null | undefined>) {
  const normalized = text.toLowerCase();
  return candidates.some((candidate) => candidate && normalized.includes(candidate.toLowerCase()));
}

function safeIntent(message: string): RetrievalIntent {
  if (/\b(schedule|reschedule|rebuild|plan my|move|shift|spread|redistribute|lighter|study blocks?|study sessions?|free my|clear (?:up|my)|evenings? free)\b/i.test(message)) return "rebuild_schedule";
  if (/\b(grade|gpa|score|performance|progress|trend|standing|doing in)\b/i.test(message)) return "review_progress";
  if (/\b(upload|attached|assignment brief|analy[sz]e assignment)\b/i.test(message)) return "analyze_assignment";
  return "answer";
}

export function fallbackRetrievalPlan({
  latestMessage,
  history,
  index,
  now = new Date(),
  forcedIntent,
}: {
  latestMessage: string;
  history: ConversationMessage[];
  index: CompactAcademicIndex;
  now?: Date;
  forcedIntent?: RetrievalIntent;
}): RetrievalPlan {
  const selectedHistory = selectRetrievalPlannerHistory(history, latestMessage);
  const resolutionText = `${selectedHistory.map((item) => item.text).join(" ")} ${latestMessage}`;
  const intent = forcedIntent || safeIntent(latestMessage);
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + (intent === "rebuild_schedule" ? 14 : 30));
  const courseIds = index.courses.filter((course) => mentions(resolutionText, course.code, course.name)).map((course) => course.id);
  const assignmentIds = index.assignments.filter((assignment) => mentions(resolutionText, assignment.title)).map((assignment) => assignment.id);
  const wantsNotes = /\b(note|notes|lecture|study guide|revision|review material)\b/i.test(latestMessage);
  const matchedNote = index.notes.find((note) => mentions(resolutionText, note.title, ...note.tags));
  const historical = /\b((last|previous|past)\s+(semester|term|year|course)|historical|history|trend|prerequisite|degree plan|four years?|4 years?|all semesters?|over time|changed)\b/i.test(latestMessage);
  return {
    intent,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    courseIds: unique(courseIds),
    assignmentIds: unique(assignmentIds),
    noteQuery: wantsNotes ? matchedNote?.title || latestMessage.slice(0, 160) : null,
    includeGrades: intent === "review_progress" || /\b(grade|gpa|score|performance|standing|prioriti[sz])\b/i.test(latestMessage),
    includeHistoricalSemesters: historical,
    conversationMessageCount: selectedHistory.length,
    reason: "Safe fallback selected explicit records and a bounded near-deadline window.",
  };
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function sanitizeRetrievalPlan(
  raw: RetrievalPlan,
  index: CompactAcademicIndex,
  now = new Date(),
  availableConversationMessages: number = RETRIEVAL_LIMITS.conversationMessages,
): RetrievalPlan {
  const validCourseIds = new Set(index.courses.map((course) => course.id));
  const validAssignmentIds = new Set(index.assignments.map((assignment) => assignment.id));
  const intent: RetrievalIntent = ["answer", "analyze_assignment", "rebuild_schedule", "review_progress"].includes(raw.intent)
    ? raw.intent
    : "answer";
  const defaultStart = new Date(now);
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + (intent === "rebuild_schedule" ? 14 : 30));
  const start = validIso(raw.dateRange?.start) ? new Date(raw.dateRange.start) : defaultStart;
  let end = validIso(raw.dateRange?.end) ? new Date(raw.dateRange.end) : defaultEnd;
  if (+end < +start) end = new Date(defaultEnd);
  const maxDays = intent === "rebuild_schedule" ? 60 : raw.includeHistoricalSemesters ? 1_500 : 180;
  const maxEnd = new Date(start); maxEnd.setDate(maxEnd.getDate() + maxDays);
  if (+end > +maxEnd) end = maxEnd;
  return {
    intent,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    courseIds: unique((raw.courseIds || []).filter((id) => validCourseIds.has(id))).slice(0, 20),
    assignmentIds: unique((raw.assignmentIds || []).filter((id) => validAssignmentIds.has(id))).slice(0, 30),
    noteQuery: typeof raw.noteQuery === "string" && raw.noteQuery.trim() ? raw.noteQuery.trim().slice(0, 200) : null,
    includeGrades: Boolean(raw.includeGrades),
    includeHistoricalSemesters: Boolean(raw.includeHistoricalSemesters),
    conversationMessageCount: Math.max(0, Math.min(Number(raw.conversationMessageCount) || 0, availableConversationMessages, RETRIEVAL_LIMITS.conversationMessages)),
    reason: typeof raw.reason === "string" ? raw.reason.slice(0, 500) : "Bounded retrieval plan.",
  };
}

function resolveDateRange(plan: RetrievalPlan, now: Date) {
  const start = validIso(plan.dateRange.start) ? new Date(plan.dateRange.start) : new Date(now);
  const end = validIso(plan.dateRange.end) ? new Date(plan.dateRange.end) : new Date(+start + 14 * 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function selectAssignments(userId: string, plan: RetrievalPlan, range: { start: string; end: string }, currentSemesterId: string | null) {
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<string | number> = [userId];
  if (plan.assignmentIds.length) {
    conditions.push(`id IN (${placeholders(plan.assignmentIds)})`);
    params.push(...plan.assignmentIds);
  }
  if (plan.courseIds.length) {
    conditions.push(plan.intent === "rebuild_schedule"
      ? `(course_id IN (${placeholders(plan.courseIds)}) AND status!='completed')`
      : `course_id IN (${placeholders(plan.courseIds)})`);
    params.push(...plan.courseIds);
  }
  if (plan.intent === "rebuild_schedule" || (!plan.assignmentIds.length && !plan.courseIds.length)) {
    conditions.push("(status!='completed' AND due_at>=? AND due_at<=?)");
    params.push(range.start, range.end);
  }
  if (plan.intent === "review_progress" && currentSemesterId && !plan.courseIds.length) {
    conditions.push("course_id IN (SELECT id FROM courses WHERE user_id=? AND semester_id=?)");
    params.push(userId, currentSemesterId);
  }
  if (!conditions.length) return [];
  params.push(RETRIEVAL_LIMITS.assignments);
  const rows = db.prepare(
    `SELECT id,course_id as courseId,title,substr(description,1,${RETRIEVAL_LIMITS.assignmentDescriptionCharacters}) as description,due_at as dueAt,status,priority,estimated_minutes as estimatedMinutes,actual_minutes as actualMinutes,progress,created_at as createdAt FROM assignments WHERE user_id=? AND (${conditions.join(" OR ")}) ORDER BY due_at LIMIT ?`,
  ).all(...params) as Assignment[];
  if (!rows.length) return rows;
  const ids = rows.map((assignment) => assignment.id);
  const subtasks = db.prepare(
    `SELECT id,assignment_id as assignmentId,title,estimated_minutes as estimatedMinutes,status,position FROM subtasks WHERE user_id=? AND assignment_id IN (${placeholders(ids)}) ORDER BY assignment_id,position LIMIT ?`,
  ).all(userId, ...ids, RETRIEVAL_LIMITS.subtasks) as Subtask[];
  rows.forEach((assignment) => { assignment.subtasks = subtasks.filter((subtask) => subtask.assignmentId === assignment.id).slice(0, 10); });
  return rows;
}

function selectCourses(userId: string, plan: RetrievalPlan, assignmentCourseIds: string[], currentSemesterId: string | null) {
  const db = getDb();
  const ids = unique([...plan.courseIds, ...assignmentCourseIds]);
  const params: Array<string | number> = [userId];
  let condition: string;
  if (ids.length) {
    condition = `id IN (${placeholders(ids)})`;
    params.push(...ids);
  } else if (plan.includeHistoricalSemesters) {
    condition = "1=1";
  } else if (currentSemesterId) {
    condition = "semester_id=?";
    params.push(currentSemesterId);
  } else {
    return [];
  }
  params.push(RETRIEVAL_LIMITS.courses);
  return db.prepare(
    `SELECT id,semester_id as semesterId,code,name,color,credits,progress FROM courses WHERE user_id=? AND ${condition} ORDER BY created_at LIMIT ?`,
  ).all(...params) as Course[];
}

export function getRelevantCourses(
  userId: string,
  courseIds: string[] = [],
  includeHistoricalSemesters = false,
  now = new Date(),
) {
  seedUser(userId);
  const current = currentSemester(userId, now);
  const validIds = unique(courseIds).slice(0, RETRIEVAL_LIMITS.courses);
  return selectCourses(
    userId,
    {
      intent: "analyze_assignment",
      dateRange: { start: null, end: null },
      courseIds: validIds,
      assignmentIds: [],
      noteQuery: null,
      includeGrades: false,
      includeHistoricalSemesters,
      conversationMessageCount: 0,
      reason: "Retrieve bounded course options for assignment extraction.",
    },
    [],
    current?.id || null,
  );
}

function selectNotes(userId: string, plan: RetrievalPlan) {
  const shouldUseCourseMatch = plan.intent === "answer" && plan.courseIds.length > 0;
  if (!plan.noteQuery && !shouldUseCourseMatch) return [];
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<string | number> = [userId];
  if (shouldUseCourseMatch) {
    conditions.push(`course_id IN (${placeholders(plan.courseIds)})`);
    params.push(...plan.courseIds);
  }
  if (plan.noteQuery) {
    const terms = unique(plan.noteQuery.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 3)).slice(0, 5);
    const searches = terms.length ? terms : [plan.noteQuery.toLowerCase()];
    for (const term of searches) {
      const search = `%${term}%`;
      conditions.push("(lower(title) LIKE ? OR lower(tags) LIKE ? OR lower(content) LIKE ?)");
      params.push(search, search, search);
    }
  }
  params.push(RETRIEVAL_LIMITS.notes);
  const rows = db.prepare(
    `SELECT id,course_id as courseId,title,substr(content,1,${RETRIEVAL_LIMITS.noteCharacters}) as content,tags,pinned,created_at as createdAt,updated_at as updatedAt FROM notes WHERE user_id=? AND (${conditions.join(" OR ")}) ORDER BY pinned DESC,updated_at DESC LIMIT ?`,
  ).all(...params) as Array<Omit<Note, "tags" | "pinned"> & { tags: string; pinned: number }>;
  return rows.map((note) => ({ ...note, tags: parseTags(note.tags), pinned: Boolean(note.pinned) }));
}

function selectGrades(userId: string, plan: RetrievalPlan, currentSemesterId: string | null) {
  if (!plan.includeGrades) return [];
  const db = getDb();
  const params: Array<string | number> = [userId];
  let condition = "1=1";
  if (plan.courseIds.length) {
    condition = `course_id IN (${placeholders(plan.courseIds)})`;
    params.push(...plan.courseIds);
  } else if (!plan.includeHistoricalSemesters && currentSemesterId) {
    condition = "course_id IN (SELECT id FROM courses WHERE user_id=? AND semester_id=?)";
    params.push(userId, currentSemesterId);
  }
  params.push(RETRIEVAL_LIMITS.grades);
  return db.prepare(
    `SELECT id,course_id as courseId,title,score,max_score as maxScore,weight FROM grades WHERE user_id=? AND ${condition} ORDER BY course_id,id LIMIT ?`,
  ).all(...params) as Grade[];
}

function selectEvents(userId: string, plan: RetrievalPlan, range: { start: string; end: string }) {
  if (plan.intent !== "rebuild_schedule") return [];
  const rows = getDb().prepare(
    "SELECT id,course_id as courseId,assignment_id as assignmentId,title,start_at as startAt,end_at as endAt,type,locked FROM calendar_events WHERE user_id=? AND locked=1 AND start_at<? AND end_at>? ORDER BY start_at LIMIT ?",
  ).all(userId, range.end, range.start, RETRIEVAL_LIMITS.events) as Array<Omit<CalendarEvent, "locked"> & { locked: number }>;
  return rows.map((event) => ({ ...event, locked: Boolean(event.locked) }));
}

function selectStudySessions(userId: string, plan: RetrievalPlan, range: { start: string; end: string }) {
  if (plan.intent !== "rebuild_schedule") return [];
  return getDb().prepare(
    "SELECT id,assignment_id as assignmentId,subtask_id as subtaskId,title,start_at as startAt,end_at as endAt,status,plan_id as planId FROM study_sessions WHERE user_id=? AND start_at<? AND end_at>? ORDER BY start_at LIMIT ?",
  ).all(userId, range.end, range.start, RETRIEVAL_LIMITS.studySessions) as StudySession[];
}

function selectSemesters(userId: string, includeHistorical: boolean) {
  if (!includeHistorical) return [];
  return getDb().prepare(
    "SELECT id,name,number,start_date as startDate,end_date as endDate FROM semesters WHERE user_id=? ORDER BY number LIMIT ?",
  ).all(userId, RETRIEVAL_LIMITS.semesters) as AcademicData["semesters"];
}

export function retrieveAcademicContext(userId: string, plan: RetrievalPlan, now = new Date()): RetrievedAcademicContext {
  seedUser(userId);
  const db = getDb();
  const profileRow = db.prepare("SELECT timezone,max_daily_minutes as maxDailyMinutes FROM users WHERE id=?").get(userId) as UserProfileRow;
  const current = currentSemester(userId, now) || null;
  const range = resolveDateRange(plan, now);
  const assignments = selectAssignments(userId, plan, range, current?.id || null);
  const courses = selectCourses(userId, plan, assignments.map((assignment) => assignment.courseId), current?.id || null);
  return {
    profile: { timezone: profileRow.timezone, maxDailyMinutes: profileRow.maxDailyMinutes, currentSemester: current },
    dateRange: range,
    courses,
    assignments,
    notes: selectNotes(userId, plan),
    grades: selectGrades(userId, plan, current?.id || null),
    events: selectEvents(userId, plan, range),
    studySessions: selectStudySessions(userId, plan, range),
    semesters: selectSemesters(userId, plan.includeHistoricalSemesters),
  };
}

export function buildRetrievalMetadata(plan: RetrievalPlan, context: RetrievedAcademicContext): RetrievalMetadata {
  return {
    intent: plan.intent,
    selectedRecordIds: {
      courses: context.courses.map((course) => course.id),
      assignments: context.assignments.map((assignment) => assignment.id),
      notes: context.notes.map((note) => note.id),
      grades: context.grades.map((grade) => grade.id),
      events: context.events.map((event) => event.id),
      studySessions: context.studySessions.map((session) => session.id),
      semesters: context.semesters.map((semester) => semester.id),
    },
    dateRange: context.dateRange,
    recordCounts: {
      courses: context.courses.length,
      assignments: context.assignments.length,
      notes: context.notes.length,
      grades: context.grades.length,
      events: context.events.length,
      studySessions: context.studySessions.length,
      semesters: context.semesters.length,
    },
    gradesIncluded: context.grades.length > 0,
    historicalSemestersIncluded: context.semesters.length > 0,
    conversationMessageCount: plan.conversationMessageCount,
  };
}

export function toScheduleData(context: RetrievedAcademicContext): Pick<AcademicData, "assignments" | "events" | "studySessions"> {
  return { assignments: context.assignments, events: context.events, studySessions: context.studySessions };
}
