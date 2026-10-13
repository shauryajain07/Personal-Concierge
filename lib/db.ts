import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AcademicData, Assignment, CalendarEvent, Course, Grade, Memory, Note, StudySession, Subtask, Task } from "./types";

const globalForDb = globalThis as unknown as { almaDb?: Database.Database };

export function databasePath() {
  return process.env.ALMA_DB_PATH || join(process.cwd(), "data", "alma.db");
}

export function getDb() {
  if (!globalForDb.almaDb) {
    const path = databasePath();
    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    globalForDb.almaDb = db;
  }
  // Dev hot reload keeps the SQLite connection alive. Run idempotent migrations
  // on every access so a newly added table is available without restarting.
  migrate(globalForDb.almaDb);
  return globalForDb.almaDb;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      max_daily_minutes INTEGER NOT NULL DEFAULT 240,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      number INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6258df',
      credits INTEGER NOT NULL DEFAULT 3,
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      priority TEXT NOT NULL DEFAULT 'medium',
      estimated_minutes INTEGER NOT NULL DEFAULT 60,
      actual_minutes INTEGER NOT NULL DEFAULT 0,
      progress INTEGER NOT NULL DEFAULT 0,
      source_file_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'pending',
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      include_in_context INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'preference',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      score REAL NOT NULL,
      max_score REAL NOT NULL DEFAULT 100,
      weight REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
      assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'personal',
      locked INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      subtask_id TEXT REFERENCES subtasks(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      plan_id TEXT
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
      assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      ai_summary TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS assignments_user_due_idx ON assignments(user_id, due_at);
    CREATE INDEX IF NOT EXISTS tasks_user_due_idx ON tasks(user_id, due_at);
    CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON notes(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_user_start_idx ON study_sessions(user_id, start_at);
    CREATE INDEX IF NOT EXISTS memories_user_updated_idx ON memories(user_id, enabled, updated_at DESC);
  `);
  const noteColumns = db.pragma("table_info(notes)") as Array<{ name: string }>;
  if (!noteColumns.some((column) => column.name === "include_in_context")) {
    db.exec("ALTER TABLE notes ADD COLUMN include_in_context INTEGER NOT NULL DEFAULT 1");
  }
}

export function ensureUser(userId = "local-student") {
  getDb().prepare("INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)").run(userId, "Student");
}

function rows<T>(db: Database.Database, sql: string, userId: string): T[] { return db.prepare(sql).all(userId) as T[]; }

export function getAcademicData(userId = "local-student"): AcademicData {
  ensureUser(userId);
  const db = getDb();
  const semesters = rows<Record<string, unknown>>(db,"SELECT id,name,number,start_date as startDate,end_date as endDate FROM semesters WHERE user_id=? ORDER BY number",userId);
  const courses = rows<Course>(db,"SELECT id,semester_id as semesterId,code,name,color,credits,progress FROM courses WHERE user_id=? ORDER BY created_at",userId);
  const assignments = rows<Assignment>(db,"SELECT id,course_id as courseId,title,description,due_at as dueAt,status,priority,estimated_minutes as estimatedMinutes,actual_minutes as actualMinutes,progress,created_at as createdAt FROM assignments WHERE user_id=? ORDER BY due_at",userId);
  const subtasks = rows<Subtask>(db,"SELECT id,assignment_id as assignmentId,title,estimated_minutes as estimatedMinutes,status,position FROM subtasks WHERE user_id=? ORDER BY position",userId);
  assignments.forEach((assignment) => { assignment.subtasks = subtasks.filter((subtask) => subtask.assignmentId === assignment.id); });
  const noteRows = rows<Omit<Note,"tags"|"pinned"|"includeInContext"> & {tags:string;pinned:number;includeInContext:number}>(db,"SELECT id,course_id as courseId,title,content,tags,pinned,include_in_context as includeInContext,created_at as createdAt,updated_at as updatedAt FROM notes WHERE user_id=? ORDER BY pinned DESC, updated_at DESC",userId);
  const notes = noteRows.map((note) => ({...note,tags:JSON.parse(note.tags || "[]"),pinned:Boolean(note.pinned),includeInContext:Boolean(note.includeInContext)}));
  const memoryRows = rows<Omit<Memory,"enabled"> & {enabled:number}>(db,"SELECT id,title,content,category,enabled,created_at as createdAt,updated_at as updatedAt FROM memories WHERE user_id=? ORDER BY updated_at DESC",userId);
  const memories = memoryRows.map((memory) => ({...memory,enabled:Boolean(memory.enabled)}));
  const tasks = rows<Task>(db,"SELECT id,course_id as courseId,title,description,due_at as dueAt,status,priority,estimated_minutes as estimatedMinutes,created_at as createdAt,updated_at as updatedAt FROM tasks WHERE user_id=? ORDER BY status, due_at IS NULL, due_at, created_at DESC",userId);
  const grades = rows<Grade>(db,"SELECT id,course_id as courseId,title,score,max_score as maxScore,weight FROM grades WHERE user_id=?",userId);
  const eventRows = rows<Omit<CalendarEvent,"locked"> & {locked:number}>(db,"SELECT id,course_id as courseId,assignment_id as assignmentId,title,start_at as startAt,end_at as endAt,type,locked FROM calendar_events WHERE user_id=? ORDER BY start_at",userId);
  const events = eventRows.map((event) => ({...event,locked:Boolean(event.locked)}));
  const studySessions = rows<StudySession>(db,"SELECT id,assignment_id as assignmentId,subtask_id as subtaskId,title,start_at as startAt,end_at as endAt,status,plan_id as planId FROM study_sessions WHERE user_id=? ORDER BY start_at",userId);
  return { semesters: semesters as AcademicData["semesters"], courses, assignments, tasks, notes, memories, grades, events, studySessions, aiConfigured:false };
}

export function userIdFromRequest(request: Request) {
  return request.headers.get("x-alma-user") || "local-student";
}
