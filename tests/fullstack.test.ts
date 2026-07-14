import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

const directory = mkdtempSync(join(tmpdir(), "alma-test-"));
process.chdir(directory);

const { getAcademicData, getDb } = await import("../lib/db");
const { buildSchedule, applySchedule } = await import("../lib/scheduler");
const {
  RETRIEVAL_LIMITS,
  getCompactAcademicIndex,
  retrieveAcademicContext,
} = await import("../lib/retrieval");
const { compactIndexContainsNoPrivateBodies, planAcademicRetrieval } = await import("../lib/retrieval-pipeline");
const {
  CODEX_SESSION_COOKIE,
  almaCodexModel,
  codexEnvironment,
  codexSessionIdFromRequest,
  createCodexSessionId,
} = await import("../lib/codex-auth");
const { getCodexAuthStatus } = await import("../lib/codex");
const { applyWorkspaceActions, looksLikeWorkspaceCommand } = await import("../lib/workspace-actions");
const { extractDocument } = await import("../app/api/assignments/analyze/route");
const { POST: createAssignment } = await import("../app/api/assignments/route");
const { POST: createNote } = await import("../app/api/notes/route");
const { POST: applyPlannerChanges } = await import("../app/api/planner/apply/route");
const { POST: askPlanner } = await import("../app/api/planner/route");
const { POST: analyzeAssignment } = await import("../app/api/assignments/analyze/route");

after(() => rmSync(directory, { recursive: true, force: true }));

test("creates the complete four-year academic structure", () => {
  const data = getAcademicData("student-test");
  assert.equal(data.semesters.length, 8);
  assert.equal(data.courses.length, 4);
  assert.equal(data.assignments.length, 4);
  assert.ok(data.assignments[0].subtasks?.length);
  assert.equal(data.notes.length, 2);
  assert.equal(data.grades.length, 4);
});

test("persists notes in the SQL database", () => {
  const db = getDb();
  db.prepare("INSERT INTO notes (id,user_id,course_id,title,content) VALUES (?,?,?,?,?)").run("note-test","student-test","course-phy","Persisted note","Saved content");
  const data = getAcademicData("student-test");
  assert.equal(data.notes.find((note) => note.id === "note-test")?.content, "Saved content");
});

test("builds conflict-free sessions before assignment deadlines", () => {
  const data = getAcademicData("student-test");
  const plan = buildSchedule(data);
  assert.ok(plan.length > 0);
  for (const session of plan) {
    const assignment = data.assignments.find((item) => item.id === session.assignmentId);
    assert.ok(assignment);
    assert.ok(+new Date(session.endAt) <= +new Date(assignment!.dueAt));
    for (const event of data.events) {
      const overlap = +new Date(session.startAt) < +new Date(event.endAt) && +new Date(event.startAt) < +new Date(session.endAt);
      assert.equal(overlap, false);
    }
  }
  applySchedule("student-test", plan.slice(0, 2), "plan-test");
  assert.equal(getAcademicData("student-test").studySessions.length, 2);
});

test("honors requested study-hour and session-length constraints", () => {
  const data = getAcademicData("student-test");
  const plan = buildSchedule(data, { earliestStartHour: 9, latestEndHour: 17, preferredSessionMinutes: 45 });
  assert.ok(plan.length > 0);
  for (const session of plan) {
    const start = new Date(session.startAt);
    const end = new Date(session.endAt);
    assert.ok(start.getHours() >= 9);
    assert.ok(end.getHours() <= 17);
    assert.ok((+end - +start) / 60000 <= 45);
  }
});

test("compact retrieval planning index never contains private record bodies", () => {
  const { index } = getCompactAcademicIndex("student-test");
  assert.equal(compactIndexContainsNoPrivateBodies(index), true);
  assert.equal(JSON.stringify(index).includes("uncertainty principle"), false);
  assert.equal(JSON.stringify(index).includes("2,000-word monetary policy"), false);
  assert.equal(JSON.stringify(index).includes("Midterm"), false);
  assert.equal(JSON.stringify(index).includes("Football practice"), false);
});

test("one-course retrieval excludes unrelated courses and notes", () => {
  const now = new Date();
  const context = retrieveAcademicContext("student-test", {
    intent: "answer",
    dateRange: { start: now.toISOString(), end: new Date(+now + 30 * 86_400_000).toISOString() },
    courseIds: ["course-phy"],
    assignmentIds: [],
    noteQuery: "quantum wave functions",
    includeGrades: false,
    includeHistoricalSemesters: false,
    conversationMessageCount: 0,
    reason: "The student asked only about Modern Physics.",
  }, now);
  assert.deepEqual(context.courses.map((course) => course.id), ["course-phy"]);
  assert.ok(context.notes.length > 0);
  assert.ok(context.notes.every((note) => note.courseId === "course-phy"));
  assert.equal(JSON.stringify(context).includes("Monetary policy essay sources"), false);
  assert.equal(context.grades.length, 0);
  assert.equal(context.semesters.length, 0);
});

test("schedule retrieval is bounded to incomplete work and commitments in its window", () => {
  const db = getDb();
  const now = new Date();
  const end = new Date(+now + 4 * 86_400_000);
  const outsideStart = new Date(+now + 30 * 86_400_000);
  const outsideEnd = new Date(+outsideStart + 3_600_000);
  db.prepare("INSERT INTO calendar_events (id,user_id,title,start_at,end_at,type,locked) VALUES (?,?,?,?,?,'personal',1)")
    .run("event-outside-window", "student-test", "Far commitment", outsideStart.toISOString(), outsideEnd.toISOString());
  db.prepare("INSERT INTO assignments (id,user_id,course_id,title,description,due_at,status,priority,estimated_minutes) VALUES (?,?,?,?,?,?,'not_started','low',60)")
    .run("asg-far", "student-test", "course-phy", "Far future worksheet", "Must stay out of near retrieval.", outsideEnd.toISOString());
  const context = retrieveAcademicContext("student-test", {
    intent: "rebuild_schedule",
    dateRange: { start: now.toISOString(), end: end.toISOString() },
    courseIds: [],
    assignmentIds: [],
    noteQuery: null,
    includeGrades: false,
    includeHistoricalSemesters: false,
    conversationMessageCount: 0,
    reason: "Rebuild the next four days.",
  }, now);
  assert.deepEqual(context.assignments.map((assignment) => assignment.id), ["asg-phy"]);
  assert.equal(context.events.some((event) => event.id === "event-outside-window"), false);
  assert.ok(context.events.every((event) => +new Date(event.startAt) < +end && +new Date(event.endAt) > +now));
  assert.ok(context.studySessions.every((session) => +new Date(session.startAt) < +end && +new Date(session.endAt) > +now));
});

test("grade retrieval includes scoped grades only when requested", () => {
  const now = new Date();
  const plan = {
    intent: "review_progress" as const,
    dateRange: { start: now.toISOString(), end: new Date(+now + 30 * 86_400_000).toISOString() },
    courseIds: ["course-phy"],
    assignmentIds: [],
    noteQuery: null,
    includeGrades: true,
    includeHistoricalSemesters: false,
    conversationMessageCount: 0,
    reason: "Review the Modern Physics grade.",
  };
  const context = retrieveAcademicContext("student-test", plan, now);
  assert.deepEqual(context.grades.map((grade) => grade.id), ["g1"]);
  assert.ok(context.grades.every((grade) => grade.courseId === "course-phy"));
  assert.equal(context.semesters.length, 0);
});

test("follow-ups resolve the prior subject with limited recent history", async () => {
  const history = [
    { role: "user" as const, text: "Plan my Quantum Mechanics Test." },
    { role: "assistant" as const, text: "I made a plan for the physics test." },
    { role: "user" as const, text: "Keep tomorrow evening open." },
    { role: "assistant" as const, text: "Done." },
  ];
  const retrieval = await planAcademicRetrieval({
    userId: "student-test",
    latestMessage: "Make that lighter.",
    history,
    plannerCall: async () => { throw new Error("simulated retrieval planning failure"); },
  });
  assert.equal(retrieval.usedFallback, true);
  assert.equal(retrieval.plan.intent, "rebuild_schedule");
  assert.ok(retrieval.plan.assignmentIds.includes("asg-phy"));
  assert.ok(retrieval.answerHistory.length > 0);
  assert.ok(retrieval.answerHistory.length <= RETRIEVAL_LIMITS.conversationMessages);
});

test("simple chat uses the bounded fast path without a planning-model call", async () => {
  let plannerInvoked = false;
  const retrieval = await planAcademicRetrieval({
    userId: "student-test",
    latestMessage: "What is my next deadline?",
    history: [],
    fastPath: true,
    plannerCall: async () => { plannerInvoked = true; throw new Error("planner should be skipped"); },
  });
  assert.equal(plannerInvoked, false);
  assert.equal(retrieval.usedFallback, false);
  assert.equal(retrieval.plan.intent, "answer");
  assert.ok(retrieval.plan.dateRange.start);
});

test("retrieval failure falls back to bounded current records, never the entire workspace", async () => {
  const retrieval = await planAcademicRetrieval({
    userId: "student-test",
    latestMessage: "Rebuild my schedule for the next week.",
    history: [],
    plannerCall: async () => { throw new Error("simulated retrieval planning failure"); },
  });
  const context = retrieveAcademicContext("student-test", retrieval.plan);
  assert.equal(retrieval.usedFallback, true);
  assert.equal(context.assignments.some((assignment) => assignment.id === "asg-far"), false);
  assert.equal(context.notes.length, 0);
  assert.equal(context.grades.length, 0);
  assert.equal(context.semesters.length, 0);
  assert.ok(context.assignments.length <= RETRIEVAL_LIMITS.assignments);
});

test("planner and assignment analysis require ChatGPT instead of returning local answers", async () => {
  const plannerResponse = await askPlanner(new Request("http://alma.test/api/planner", {
    method: "POST",
    headers: { "content-type": "application/json", "x-alma-user": "student-test" },
    body: JSON.stringify({ message: "hi" }),
  }));
  assert.equal(plannerResponse.status, 401);
  assert.equal((await plannerResponse.json()).code, "CHATGPT_LOGIN_REQUIRED");

  const analysisResponse = await analyzeAssignment(new Request("http://alma.test/api/assignments/analyze", {
    method: "POST",
    headers: { "x-alma-user": "student-test" },
    body: new FormData(),
  }));
  assert.equal(analysisResponse.status, 401);
  assert.equal((await analysisResponse.json()).code, "CHATGPT_LOGIN_REQUIRED");
});

test("assignment upload extraction, assignment save, note save, and schedule apply still work", async () => {
  const extracted = await extractDocument(Buffer.from("PHY 204 problem set due Friday"), "brief.txt", join(directory, "brief.txt"));
  assert.equal(extracted.text, "PHY 204 problem set due Friday");

  const assignmentResponse = await createAssignment(new Request("http://alma.test/api/assignments", {
    method: "POST",
    headers: { "content-type": "application/json", "x-alma-user": "student-test" },
    body: JSON.stringify({
      courseId: "course-phy",
      title: "Saved through assignment API",
      description: "Regression test",
      dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      subtasks: [{ title: "Solve", estimatedMinutes: 30 }],
    }),
  }));
  assert.equal(assignmentResponse.status, 201);
  const assignmentId = String((await assignmentResponse.json()).id);
  assert.ok(getDb().prepare("SELECT id FROM assignments WHERE user_id=? AND id=?").get("student-test", assignmentId));

  const noteResponse = await createNote(new Request("http://alma.test/api/notes", {
    method: "POST",
    headers: { "content-type": "application/json", "x-alma-user": "student-test" },
    body: JSON.stringify({ courseId: "course-phy", title: "Saved through note API", content: "Persistent text" }),
  }));
  assert.equal(noteResponse.status, 201);
  const noteId = String((await noteResponse.json()).id);
  assert.ok(getDb().prepare("SELECT id FROM notes WHERE user_id=? AND id=?").get("student-test", noteId));

  const plan = buildSchedule(getAcademicData("student-test"), { focusIds: [assignmentId] }).slice(0, 1);
  assert.equal(plan.length, 1);
  const applyResponse = await applyPlannerChanges(new Request("http://alma.test/api/planner/apply", {
    method: "POST",
    headers: { "content-type": "application/json", "x-alma-user": "student-test" },
    body: JSON.stringify({ planId: "route-regression-plan", changes: plan }),
  }));
  assert.equal(applyResponse.status, 200);
  assert.ok(getDb().prepare("SELECT id FROM study_sessions WHERE user_id=? AND plan_id=?").get("student-test", "route-regression-plan"));
});

test("chat workspace actions create, edit, complete, and delete user-scoped records", () => {
  assert.equal(looksLikeWorkspaceCommand("Add a task to email my tutor tomorrow"), true);
  const created = applyWorkspaceActions("student-test", [{
    kind: "create_task", targetId: null, courseId: "course-phy", title: "Email tutor", description: null,
    dueAt: new Date(Date.now() + 86_400_000).toISOString(), startAt: null, endAt: null, status: null,
    priority: "high", estimatedMinutes: 10, progress: null, eventType: null,
  }]);
  assert.equal(created.length, 1);
  assert.equal(getAcademicData("student-test").tasks.find((task) => task.id === created[0].id)?.title, "Email tutor");

  applyWorkspaceActions("student-test", [{
    kind: "update_task", targetId: created[0].id, courseId: null, title: null, description: null, dueAt: null,
    startAt: null, endAt: null, status: "completed", priority: null, estimatedMinutes: null, progress: null, eventType: null,
  }]);
  assert.equal(getAcademicData("student-test").tasks.find((task) => task.id === created[0].id)?.status, "completed");

  const start = new Date(Date.now() + 2 * 86_400_000); const end = new Date(+start + 3_600_000);
  const event = applyWorkspaceActions("student-test", [{
    kind: "create_event", targetId: null, courseId: null, title: "Office hours", description: null, dueAt: null,
    startAt: start.toISOString(), endAt: end.toISOString(), status: null, priority: null, estimatedMinutes: null, progress: null, eventType: "personal",
  }]);
  assert.ok(getAcademicData("student-test").events.some((item) => item.id === event[0].id));
  const movedStart = new Date(+start + 86_400_000);
  applyWorkspaceActions("student-test", [{
    kind: "update_event", targetId: event[0].id, courseId: null, title: null, description: null, dueAt: null,
    startAt: movedStart.toISOString(), endAt: null, status: null, priority: null, estimatedMinutes: null, progress: null, eventType: null,
  }]);
  const moved = getAcademicData("student-test").events.find((item) => item.id === event[0].id)!;
  assert.equal(moved.startAt, movedStart.toISOString());
  assert.equal(+new Date(moved.endAt) - +new Date(moved.startAt), 3_600_000);
  applyWorkspaceActions("student-test", [{
    kind: "delete_event", targetId: event[0].id, courseId: null, title: null, description: null, dueAt: null,
    startAt: null, endAt: null, status: null, priority: null, estimatedMinutes: null, progress: null, eventType: null,
  }]);
  assert.equal(getAcademicData("student-test").events.some((item) => item.id === event[0].id), false);

  getDb().prepare("INSERT INTO users (id,name) VALUES (?,?)").run("another-student", "Another Student");
  assert.throws(() => applyWorkspaceActions("another-student", [{
    kind: "delete_task", targetId: created[0].id, courseId: null, title: null, description: null, dueAt: null,
    startAt: null, endAt: null, status: null, priority: null, estimatedMinutes: null, progress: null, eventType: null,
  }]), /no longer exists/);
});

test("Codex authentication is isolated per browser and never falls back to the machine owner", async () => {
  const disconnected = await getCodexAuthStatus(null);
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.method, "none");

  const sessionId = createCodexSessionId();
  const request = new Request("http://alma.test/api/data", { headers: { cookie: `${CODEX_SESSION_COOKIE}=${sessionId}` } });
  assert.equal(codexSessionIdFromRequest(request), sessionId);
  assert.equal(codexSessionIdFromRequest(new Request("http://alma.test", { headers: { cookie: `${CODEX_SESSION_COOKIE}=../../owner` } })), null);

  const previousApiKey = process.env.OPENAI_API_KEY;
  const previousAccessToken = process.env.CODEX_ACCESS_TOKEN;
  process.env.OPENAI_API_KEY = "must-not-leak";
  process.env.CODEX_ACCESS_TOKEN = "must-not-leak";
  const environment = codexEnvironment(sessionId);
  assert.equal(environment.OPENAI_API_KEY, undefined);
  assert.equal(environment.CODEX_ACCESS_TOKEN, undefined);
  assert.ok(environment.CODEX_HOME?.includes(sessionId));
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousApiKey;
  if (previousAccessToken === undefined) delete process.env.CODEX_ACCESS_TOKEN; else process.env.CODEX_ACCESS_TOKEN = previousAccessToken;
  assert.equal(almaCodexModel(), process.env.ALMA_CODEX_MODEL || "gpt-5.6-luna");
});
