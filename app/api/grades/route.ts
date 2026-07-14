import { randomUUID } from "node:crypto";
import { getDb,seedUser,userIdFromRequest } from "@/lib/db";
export const runtime="nodejs";
export async function POST(request:Request){const userId=userIdFromRequest(request);seedUser(userId);const input=await request.json() as {courseId?:string;title?:string;score?:number;maxScore?:number;weight?:number};if(!input.courseId||!input.title||input.score===undefined)return Response.json({error:"Course, title, and score are required"},{status:400});const id=randomUUID();getDb().prepare("INSERT INTO grades (id,user_id,course_id,title,score,max_score,weight) VALUES (?,?,?,?,?,?,?)").run(id,userId,input.courseId,input.title,input.score,input.maxScore||100,input.weight||0);return Response.json({id},{status:201});}
