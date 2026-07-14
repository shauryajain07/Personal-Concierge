import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AcademicData, Assignment, CalendarEvent, Course, Grade, Note, StudySession, Subtask, Task } from "./types";

const globalForDb = globalThis as unknown as { almaDb?: Database.Database };

function databasePath() {
  return join(process.cwd(), "data", "alma.db");
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
  `);
}

export function seedUser(userId = "local-student") {
  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (exists) return;
  const now = new Date();
  const year = now.getFullYear();
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO users (id, name) VALUES (?, ?)").run(userId, "Shaurya Jain");
    for (let n = 1; n <= 8; n++) {
      const startYear = year - 1 + Math.floor((n - 1) / 2);
      const autumn = n % 2 === 1;
      db.prepare("INSERT INTO semesters (id,user_id,name,number,start_date,end_date) VALUES (?,?,?,?,?,?)").run(
        `sem-${n}`, userId, `Semester ${n}`, n,
        autumn ? `${startYear}-07-01` : `${startYear + 1}-01-01`,
        autumn ? `${startYear}-12-15` : `${startYear + 1}-05-30`,
      );
    }
    const courseRows = [
      ["course-phy","PHY 204","Modern Physics","#7067e8",68],
      ["course-eco","ECO 202","Macroeconomics","#e36b4f",44],
      ["course-mat","MAT 212","Linear Algebra","#24956f",77],
      ["course-cs","CS 231","Data Structures","#2b78c5",52],
    ];
    const insertCourse = db.prepare("INSERT INTO courses (id,user_id,semester_id,code,name,color,credits,progress) VALUES (?,?, 'sem-3',?,?,?,?,?)");
    courseRows.forEach(([id,code,name,color,progress]) => insertCourse.run(id,userId,code,name,color,3,progress));

    const addDays = (days: number, hour = 23, minute = 59) => {
      const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, minute, 0, 0); return d.toISOString();
    };
    const assignmentRows = [
      ["asg-phy","course-phy","Quantum Mechanics Test","Review wave functions, operators, and uncertainty principle.",3,"high",260,46],
      ["asg-eco","course-eco","Policy Analysis Essay","2,000-word monetary policy analysis with four academic sources.",6,"high",420,28],
      ["asg-mat","course-mat","Problem Set 6","Eigenvalues and diagonalization problems.",8,"medium",120,0],
      ["asg-cs","course-cs","Graph Algorithms Lab","Implement Dijkstra and compare traversal performance.",9,"medium",255,0],
    ];
    const insertAssignment = db.prepare("INSERT INTO assignments (id,user_id,course_id,title,description,due_at,status,priority,estimated_minutes,progress) VALUES (?,?,?,?,?,?,'in_progress',?,?,?)");
    assignmentRows.forEach(([id,course,title,description,days,priority,minutes,progress]) => insertAssignment.run(id,userId,course,title,description,addDays(days as number),priority,minutes,progress));
    const insertSubtask = db.prepare("INSERT INTO subtasks (id,user_id,assignment_id,title,estimated_minutes,status,position) VALUES (?,?,?,?,?,'pending',?)");
    [
      ["sub-1","asg-phy","Review lecture notes",60,0],["sub-2","asg-phy","Practice problem set",90,1],["sub-3","asg-phy","Mock test and review",110,2],
      ["sub-4","asg-eco","Research sources",120,0],["sub-5","asg-eco","Create outline",60,1],["sub-6","asg-eco","Write first draft",180,2],["sub-7","asg-eco","Edit and cite",60,3],
    ].forEach(([id,a,title,min,pos]) => insertSubtask.run(id,userId,a,title,min,pos));

    const insertNote = db.prepare("INSERT INTO notes (id,user_id,course_id,title,content,tags,pinned) VALUES (?,?,?,?,?,?,?)");
    insertNote.run("note-1",userId,"course-phy","Quantum mechanics — test review","# Quantum mechanics review\n\n## Wave functions\nThe wave function describes the quantum state. The probability density is |ψ|².\n\n## Operators\nObservables correspond to Hermitian operators. Measurement returns an eigenvalue.\n\n## Questions to revisit\n- Why must the wave function be normalized?\n- Work through uncertainty principle derivation.",JSON.stringify(["test","week-8"]),1);
    insertNote.run("note-2",userId,"course-eco","Monetary policy essay sources","# Essay research\n\nCentral banks influence aggregate demand through policy rates, expectations, and credit conditions. Compare inflation targeting outcomes across two economies.\n\nSources to evaluate:\n- Central bank annual report\n- IMF working paper\n- Recent empirical journal article",JSON.stringify(["essay","research"]),0);

    const insertGrade = db.prepare("INSERT INTO grades (id,user_id,course_id,title,score,max_score,weight) VALUES (?,?,?,?,?,?,?)");
    [["g1","course-phy","Midterm",84,100,30],["g2","course-eco","Quiz average",79,100,20],["g3","course-mat","Midterm",91,100,35],["g4","course-cs","Labs",84,100,25]].forEach((g) => insertGrade.run(g[0],userId,...g.slice(1)));

    const insertEvent = db.prepare("INSERT INTO calendar_events (id,user_id,course_id,title,start_at,end_at,type,locked) VALUES (?,?,?,?,?,?,?,1)");
    const eventTime = (offset: number, hour: number, minutes = 0, duration = 75) => { const s = new Date(); s.setDate(s.getDate()+offset); s.setHours(hour,minutes,0,0); const e = new Date(s.getTime()+duration*60000); return [s.toISOString(),e.toISOString()]; };
    [["ev1","course-phy","Modern Physics",0,9,"class"],["ev2","course-mat","Linear Algebra",0,14,"class"],["ev3",null,"Football practice",1,17.5,"personal"],["ev4","course-cs","Data Structures",2,11,"class"]].forEach(([id,course,title,offset,hour,type]) => { const [s,e]=eventTime(offset as number,Math.floor(hour as number),(hour as number)%1?30:0,type==="personal"?90:75); insertEvent.run(id,userId,course,title,s,e,type); });
  });
  tx();
}

function rows<T>(db: Database.Database, sql: string, userId: string): T[] { return db.prepare(sql).all(userId) as T[]; }

export function getAcademicData(userId = "local-student"): AcademicData {
  seedUser(userId);
  const db = getDb();
  const semesters = rows<Record<string, unknown>>(db,"SELECT id,name,number,start_date as startDate,end_date as endDate FROM semesters WHERE user_id=? ORDER BY number",userId);
  const courses = rows<Course>(db,"SELECT id,semester_id as semesterId,code,name,color,credits,progress FROM courses WHERE user_id=? ORDER BY created_at",userId);
  const assignments = rows<Assignment>(db,"SELECT id,course_id as courseId,title,description,due_at as dueAt,status,priority,estimated_minutes as estimatedMinutes,actual_minutes as actualMinutes,progress,created_at as createdAt FROM assignments WHERE user_id=? ORDER BY due_at",userId);
  const subtasks = rows<Subtask>(db,"SELECT id,assignment_id as assignmentId,title,estimated_minutes as estimatedMinutes,status,position FROM subtasks WHERE user_id=? ORDER BY position",userId);
  assignments.forEach((assignment) => { assignment.subtasks = subtasks.filter((subtask) => subtask.assignmentId === assignment.id); });
  const noteRows = rows<Omit<Note,"tags"|"pinned"> & {tags:string;pinned:number}>(db,"SELECT id,course_id as courseId,title,content,tags,pinned,created_at as createdAt,updated_at as updatedAt FROM notes WHERE user_id=? ORDER BY pinned DESC, updated_at DESC",userId);
  const notes = noteRows.map((note) => ({...note,tags:JSON.parse(note.tags || "[]"),pinned:Boolean(note.pinned)}));
  const tasks = rows<Task>(db,"SELECT id,course_id as courseId,title,description,due_at as dueAt,status,priority,estimated_minutes as estimatedMinutes,created_at as createdAt,updated_at as updatedAt FROM tasks WHERE user_id=? ORDER BY status, due_at IS NULL, due_at, created_at DESC",userId);
  const grades = rows<Grade>(db,"SELECT id,course_id as courseId,title,score,max_score as maxScore,weight FROM grades WHERE user_id=?",userId);
  const eventRows = rows<Omit<CalendarEvent,"locked"> & {locked:number}>(db,"SELECT id,course_id as courseId,assignment_id as assignmentId,title,start_at as startAt,end_at as endAt,type,locked FROM calendar_events WHERE user_id=? ORDER BY start_at",userId);
  const events = eventRows.map((event) => ({...event,locked:Boolean(event.locked)}));
  const studySessions = rows<StudySession>(db,"SELECT id,assignment_id as assignmentId,subtask_id as subtaskId,title,start_at as startAt,end_at as endAt,status,plan_id as planId FROM study_sessions WHERE user_id=? ORDER BY start_at",userId);
  return { semesters: semesters as AcademicData["semesters"], courses, assignments, tasks, notes, grades, events, studySessions, aiConfigured:false };
}

export function userIdFromRequest(request: Request) {
  return request.headers.get("x-alma-user") || "local-student";
}
