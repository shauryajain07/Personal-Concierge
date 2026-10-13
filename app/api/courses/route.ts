import { randomUUID } from "node:crypto";
import { getDb, ensureUser, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = userIdFromRequest(request); ensureUser(userId);
  const input = await request.json() as { name?:string; code?:string; semesterId?:string; color?:string; credits?:number };
  if (!input.name?.trim() || !input.code?.trim()) return Response.json({error:"Course name and code are required"},{status:400});
  const semester = input.semesterId && getDb().prepare("SELECT id FROM semesters WHERE id=? AND user_id=?").get(input.semesterId,userId);
  if (!semester) return Response.json({error:"Choose a term before adding a course"},{status:400});
  const id = randomUUID();
  getDb().prepare("INSERT INTO courses (id,user_id,semester_id,code,name,color,credits) VALUES (?,?,?,?,?,?,?)").run(id,userId,input.semesterId,input.code.trim(),input.name.trim(),input.color||"#0066cc",input.credits||3);
  return Response.json({id},{status:201});
}
