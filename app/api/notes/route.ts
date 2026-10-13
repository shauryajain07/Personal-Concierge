import { randomUUID } from "node:crypto";
import { getDb, ensureUser, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId=userIdFromRequest(request); ensureUser(userId);
  const input=await request.json() as {title?:string;content?:string;courseId?:string|null;tags?:string[];includeInContext?:boolean};
  const id=randomUUID(); const now=new Date().toISOString();
  getDb().prepare("INSERT INTO notes (id,user_id,course_id,title,content,tags,pinned,include_in_context,created_at,updated_at) VALUES (?,?,?,?,?,?,0,?,?,?)").run(id,userId,input.courseId||null,input.title?.trim()||"Untitled note",input.content||"",JSON.stringify(input.tags||[]),input.includeInContext===false?0:1,now,now);
  return Response.json({id},{status:201});
}
