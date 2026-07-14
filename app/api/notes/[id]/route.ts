import { getDb, userIdFromRequest } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const userId=userIdFromRequest(request);
  const input=await request.json() as {title?:string;content?:string;courseId?:string|null;tags?:string[];pinned?:boolean};
  const current=getDb().prepare("SELECT * FROM notes WHERE id=? AND user_id=?").get(id,userId) as Record<string,unknown>|undefined;
  if(!current)return Response.json({error:"Note not found"},{status:404});
  getDb().prepare("UPDATE notes SET title=?,content=?,course_id=?,tags=?,pinned=?,updated_at=? WHERE id=? AND user_id=?").run(input.title??current.title,input.content??current.content,input.courseId===undefined?current.course_id:input.courseId,input.tags?JSON.stringify(input.tags):current.tags,input.pinned===undefined?current.pinned:Number(input.pinned),new Date().toISOString(),id,userId);
  return Response.json({ok:true});
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const result=getDb().prepare("DELETE FROM notes WHERE id=? AND user_id=?").run(id,userIdFromRequest(request)); return Response.json({ok:result.changes>0}); }
