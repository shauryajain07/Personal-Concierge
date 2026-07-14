import { applySchedule } from "@/lib/scheduler";
import { userIdFromRequest } from "@/lib/db";
import type { PlanChange } from "@/lib/types";
export const runtime="nodejs";
export async function POST(request:Request){const {planId,changes}=await request.json() as {planId?:string;changes?:PlanChange[]};if(!planId||!changes?.length)return Response.json({error:"A plan with schedule changes is required"},{status:400});applySchedule(userIdFromRequest(request),changes,planId);return Response.json({ok:true,applied:changes.length});}
