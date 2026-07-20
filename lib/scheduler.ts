import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { AcademicData, PlanChange } from "./types";

type Interval = { start: number; end: number };

function overlaps(a: Interval, b: Interval) { return a.start < b.end && b.start < a.end; }

export function buildSchedule(data: Pick<AcademicData, "assignments" | "events" | "studySessions">, options?: { focusIds?: string[]; dailyLimitMinutes?: number; earliestStartHour?: number; latestEndHour?: number; preferredSessionMinutes?: number; windowStart?: string; windowEnd?: string }) {
  const actualNow = new Date();
  const requestedStart = options?.windowStart ? new Date(options.windowStart) : actualNow;
  const now = Number.isFinite(+requestedStart) && +requestedStart > +actualNow ? requestedStart : actualNow;
  const requestedEnd = options?.windowEnd ? new Date(options.windowEnd) : null;
  const horizon = requestedEnd && Number.isFinite(+requestedEnd) ? requestedEnd : new Date(+now + 14 * 86_400_000);
  const busy: Interval[] = [
    ...data.events.map((event) => ({ start: +new Date(event.startAt), end: +new Date(event.endAt) })),
  ];
  const focus = new Set(options?.focusIds || []);
  const assignments = data.assignments
    .filter((assignment) => assignment.status !== "completed" && +new Date(assignment.dueAt) > +now)
    .sort((a,b) => {
      const focusDifference = Number(focus.has(b.id)) - Number(focus.has(a.id));
      if (focusDifference) return focusDifference;
      const priority = { high:3, medium:2, low:1 };
      return +new Date(a.dueAt) - +new Date(b.dueAt) || priority[b.priority] - priority[a.priority];
    });
  const dailyLimit = options?.dailyLimitMinutes || 240;
  const earliestStart = options?.earliestStartHour || 8;
  const latestEnd = options?.latestEndHour || 21;
  const preferredSession = options?.preferredSessionMinutes || 90;
  const dailyUsed = new Map<string,number>();
  const changes: PlanChange[] = [];

  for (const assignment of assignments) {
    let remaining = Math.max(0, Math.round(assignment.estimatedMinutes * (1 - assignment.progress / 100)) - assignment.actualMinutes);
    const deadline = Math.min(+new Date(assignment.dueAt), +horizon);
    const cursor = new Date(now);
    cursor.setMinutes(cursor.getMinutes() < 30 ? 30 : 60, 0, 0);
    if (cursor.getHours() < earliestStart) cursor.setHours(earliestStart,0,0,0);
    while (remaining > 0 && +cursor < deadline) {
      if (cursor.getHours() < earliestStart) cursor.setHours(earliestStart,0,0,0);
      if (cursor.getHours() >= latestEnd) { cursor.setDate(cursor.getDate()+1); cursor.setHours(earliestStart,0,0,0); continue; }
      const dateKey = cursor.toISOString().slice(0,10);
      const used = dailyUsed.get(dateKey) || 0;
      if (used >= dailyLimit) { cursor.setDate(cursor.getDate()+1); cursor.setHours(earliestStart,0,0,0); continue; }
      const duration = Math.min(preferredSession, Math.max(30, Math.min(remaining, dailyLimit-used)));
      const candidate = { start:+cursor, end:+cursor + duration*60000 };
      const dayCutoff = new Date(cursor); dayCutoff.setHours(latestEnd,0,0,0);
      if (candidate.end <= deadline && candidate.end <= +dayCutoff && !busy.some((interval) => overlaps(candidate,interval))) {
        const start = new Date(candidate.start); const end = new Date(candidate.end);
        changes.push({ id:randomUUID(), assignmentId:assignment.id, title:assignment.title, startAt:start.toISOString(), endAt:end.toISOString(), reason:`Protects the ${new Date(assignment.dueAt).toLocaleDateString("en-US",{weekday:"short"})} deadline` });
        busy.push(candidate); dailyUsed.set(dateKey,used+duration); remaining -= duration; cursor.setTime(candidate.end+30*60000);
      } else cursor.setTime(+cursor+30*60000);
    }
  }
  return changes;
}

export function applySchedule(userId: string, changes: PlanChange[], planId: string) {
  const db = getDb();
  const insert = db.prepare("INSERT INTO study_sessions (id,user_id,assignment_id,title,start_at,end_at,status,plan_id) VALUES (?,?,?,?,?,?,'planned',?)");
  const ownsAssignment = db.prepare("SELECT 1 FROM assignments WHERE id=? AND user_id=?");
  const clearFuturePlan = db.prepare("DELETE FROM study_sessions WHERE user_id=? AND status='planned' AND end_at>?");
  const tx = db.transaction(() => {
    for (const change of changes) {
      if (!ownsAssignment.get(change.assignmentId, userId)) throw new Error("A scheduled assignment is not in this workspace.");
    }
    clearFuturePlan.run(userId, new Date().toISOString());
    changes.forEach((change) => insert.run(change.id,userId,change.assignmentId,change.title,change.startAt,change.endAt,planId));
  });
  tx();
}
