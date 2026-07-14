import { randomUUID } from "node:crypto";
import { getDb, seedUser, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = userIdFromRequest(request); seedUser(userId);
  const input = await request.json() as { name?:string; code?:string; semesterId?:string; color?:string; credits?:number };
  if (!input.name?.trim() || !input.code?.trim()) return Response.json({error:"Course name and code are required"},{status:400});
  const id = randomUUID();
  getDb().prepare("INSERT INTO courses (id,user_id,semester_id,code,name,color,credits) VALUES (?,?,?,?,?,?,?)").run(id,userId,input.semesterId||"sem-3",input.code.trim(),input.name.trim(),input.color||"#6258df",input.credits||3);
  return Response.json({id},{status:201});
}
