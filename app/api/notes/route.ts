import { randomUUID } from "node:crypto";
import { getDb, seedUser, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId=userIdFromRequest(request); seedUser(userId);
  const input=await request.json() as {title?:string;content?:string;courseId?:string|null;tags?:string[]};
  const id=randomUUID(); const now=new Date().toISOString();
  getDb().prepare("INSERT INTO notes (id,user_id,course_id,title,content,tags,pinned,created_at,updated_at) VALUES (?,?,?,?,?,?,0,?,?)").run(id,userId,input.courseId||null,input.title?.trim()||"Untitled note",input.content||"",JSON.stringify(input.tags||[]),now,now);
  return Response.json({id},{status:201});
}
