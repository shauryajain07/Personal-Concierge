import { NextResponse } from "next/server";
import {
  CODEX_SESSION_COOKIE,
  codexSessionIdFromRequest,
  createCodexSessionId,
  getCodexSessionStatus,
  logoutCodexSession,
  startCodexDeviceLogin,
} from "@/lib/codex-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(CODEX_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function GET(request: Request) {
  return NextResponse.json(await getCodexSessionStatus(codexSessionIdFromRequest(request)));
}

export async function POST(request: Request) {
  try {
    const sessionId = codexSessionIdFromRequest(request) || createCodexSessionId();
    const response = NextResponse.json(await startCodexDeviceLogin(sessionId));
    setSessionCookie(response, sessionId);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start ChatGPT sign-in" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const sessionId = codexSessionIdFromRequest(request);
  await logoutCodexSession(sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CODEX_SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
