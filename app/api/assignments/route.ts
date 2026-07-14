import { randomUUID } from "node:crypto";
import { getDb, seedUser, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId=userIdFromRequest(request);seedUser(userId);
  const input=await request.json() as {courseId?:string;title?:string;description?:string;dueAt?:string;priority?:string;estimatedMinutes?:number;subtasks?:Array<{title:string;estimatedMinutes:number}>};
  if(!input.title?.trim()||!input.courseId||!input.dueAt)return Response.json({error:"Course, title, and deadline are required"},{status:400});
  const id=randomUUID(); const db=getDb();
  const tx=db.transaction(()=>{db.prepare("INSERT INTO assignments (id,user_id,course_id,title,description,due_at,status,priority,estimated_minutes) VALUES (?,?,?,?,?,?,'not_started',?,?)").run(id,userId,input.courseId,input.title!.trim(),input.description||"",new Date(input.dueAt!).toISOString(),input.priority||"medium",input.estimatedMinutes||60); const insert=db.prepare("INSERT INTO subtasks (id,user_id,assignment_id,title,estimated_minutes,status,position) VALUES (?,?,?,?,?,'pending',?)");(input.subtasks||[]).forEach((subtask,index)=>insert.run(randomUUID(),userId,id,subtask.title,subtask.estimatedMinutes,index));});
  tx(); return Response.json({id},{status:201});
}
