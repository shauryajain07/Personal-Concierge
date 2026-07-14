import { getAcademicData, userIdFromRequest } from "@/lib/db";
import { getCodexAuthStatus } from "@/lib/codex";
import { almaCodexModel, codexSessionIdFromRequest } from "@/lib/codex-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const codexSessionId = codexSessionIdFromRequest(request);
    const [data, auth] = await Promise.all([
      Promise.resolve(getAcademicData(userIdFromRequest(request))),
      getCodexAuthStatus(codexSessionId),
    ]);
    return Response.json({ ...data, aiConfigured: auth.connected, aiAuthMessage: auth.message, aiModel: almaCodexModel() });
  }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to load academic data" },{status:500}); }
}
