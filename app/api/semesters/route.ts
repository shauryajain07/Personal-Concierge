import { randomUUID } from "node:crypto";
import { ensureUser, getDb, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = userIdFromRequest(request);
  ensureUser(userId);
  const semesters = getDb().prepare(
    "SELECT id,name,number,start_date as startDate,end_date as endDate FROM semesters WHERE user_id=? ORDER BY start_date DESC",
  ).all(userId);
  return Response.json({ semesters });
}

export async function POST(request: Request) {
  const userId = userIdFromRequest(request);
  ensureUser(userId);
  const input = await request.json() as { name?: string; startDate?: string; endDate?: string };
  const name = input.name?.trim();
  const start = input.startDate;
  const end = input.endDate;
  if (!name || !start || !end) {
    return Response.json({ error: "Term name, start date, and end date are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)
    || !Number.isFinite(Date.parse(`${start}T00:00:00Z`))
    || !Number.isFinite(Date.parse(`${end}T00:00:00Z`))
    || end <= start) {
    return Response.json({ error: "Enter valid dates, with the end date after the start date" }, { status: 400 });
  }

  const db = getDb();
  const number = (db.prepare("SELECT COALESCE(MAX(number),0)+1 as next FROM semesters WHERE user_id=?").get(userId) as { next: number }).next;
  const id = randomUUID();
  db.prepare("INSERT INTO semesters (id,user_id,name,number,start_date,end_date) VALUES (?,?,?,?,?,?)")
    .run(id, userId, name, number, start, end);
  return Response.json({ semester: { id, name, number, startDate: start, endDate: end } }, { status: 201 });
}
