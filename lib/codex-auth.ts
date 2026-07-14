import { randomUUID } from "node:crypto";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

export const CODEX_SESSION_COOKIE = "alma_codex_session";

export type CodexSessionStatus = {
  status: "disconnected" | "pending" | "connected" | "error";
  connected: boolean;
  verificationUrl?: string;
  userCode?: string;
  message: string;
  model: string;
};

type LoginProcess = {
  child: ChildProcessWithoutNullStreams;
  status: CodexSessionStatus;
  output: string;
};

const execFileAsync = promisify(execFile);
const globalForAuth = globalThis as unknown as { almaCodexLogins?: Map<string, LoginProcess> };
const logins = globalForAuth.almaCodexLogins ||= new Map<string, LoginProcess>();
const SESSION_PATTERN = /^[a-f0-9-]{36}$/i;
const DEFAULT_MODEL = "gpt-5.6-luna";

export function almaCodexModel() {
  return process.env.ALMA_CODEX_MODEL || DEFAULT_MODEL;
}

export function createCodexSessionId() {
  return randomUUID();
}

export function validCodexSessionId(value: string | null | undefined): value is string {
  return Boolean(value && SESSION_PATTERN.test(value));
}

export function codexSessionIdFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const raw = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CODEX_SESSION_COOKIE}=`))?.slice(CODEX_SESSION_COOKIE.length + 1);
  if (!raw) return null;
  try {
    const value = decodeURIComponent(raw);
    return validCodexSessionId(value) ? value : null;
  } catch {
    return null;
  }
}

export function codexSessionHome(sessionId: string) {
  if (!validCodexSessionId(sessionId)) throw new Error("Invalid Codex session");
  return join(process.cwd(), "data/codex-sessions", sessionId);
}

export function codexEnvironment(sessionId: string): Record<string, string> & NodeJS.ProcessEnv {
  const home = codexSessionHome(sessionId);
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        !["OPENAI_API_KEY", "CODEX_API_KEY", "CODEX_ACCESS_TOKEN", "OPENAI_BASE_URL", "CODEX_HOME"].includes(entry[0]),
    ),
  );
  environment.CODEX_HOME = home;
  environment.NO_COLOR = "1";
  environment.TERM = "dumb";
  environment.NODE_ENV ||= "development";
  return environment as Record<string, string> & NodeJS.ProcessEnv;
}

function disconnected(message = "Connect your ChatGPT account to use Codex in Alma."): CodexSessionStatus {
  return { status: "disconnected", connected: false, message, model: almaCodexModel() };
}

async function persistedStatus(sessionId: string): Promise<CodexSessionStatus> {
  if (!validCodexSessionId(sessionId)) return disconnected();
  try {
    const { stdout, stderr } = await execFileAsync("codex", ["login", "status"], {
      env: codexEnvironment(sessionId),
      timeout: 5_000,
    });
    const output = `${stdout}\n${stderr}`.toLowerCase();
    if (output.includes("logged in using chatgpt")) {
      return { status: "connected", connected: true, message: "Connected to your ChatGPT account", model: almaCodexModel() };
    }
    return disconnected();
  } catch {
    return disconnected();
  }
}

export async function getCodexSessionStatus(sessionId: string | null, force = false): Promise<CodexSessionStatus> {
  if (!sessionId || !validCodexSessionId(sessionId)) return disconnected();
  const active = logins.get(sessionId);
  if (active?.status.status === "pending" && !force) return active.status;
  const persisted = await persistedStatus(sessionId);
  if (persisted.connected) {
    if (active) active.status = persisted;
    return persisted;
  }
  if (active?.status.status === "pending") return active.status;
  return active?.status.status === "error" ? active.status : persisted;
}

function updateLoginOutput(sessionId: string, chunk: Buffer) {
  const active = logins.get(sessionId);
  if (!active) return;
  active.output = `${active.output}${chunk.toString("utf8")}`.slice(-12_000);
  const url = active.output.match(/https:\/\/auth\.openai\.com\/(?:oauth\/authorize|codex\/device)[^\s\r\n]*/)?.[0];
  const code = active.output.match(/\b[A-Z0-9]{4}-[A-Z0-9]{5}\b/)?.[0];
  if (url && code) {
    active.status = {
      status: "pending",
      connected: false,
      verificationUrl: url,
      userCode: code,
      message: "Open the verification page and enter this one-time code.",
      model: almaCodexModel(),
    };
  } else if (url) {
    active.status = {
      status: "pending",
      connected: false,
      verificationUrl: url,
      message: "Complete ChatGPT sign-in in the browser window.",
      model: almaCodexModel(),
    };
  }
}

export async function startCodexDeviceLogin(sessionId: string): Promise<CodexSessionStatus> {
  if (!validCodexSessionId(sessionId)) throw new Error("Invalid Codex session");
  const existing = await getCodexSessionStatus(sessionId);
  if (existing.connected || existing.status === "pending") return existing;

  const environment = codexEnvironment(sessionId);
  const command = { program: "codex", args: ["login"] };
  const child = spawn(command.program, command.args, {
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const initial: CodexSessionStatus = {
    status: "pending",
    connected: false,
    message: "Starting ChatGPT sign-in…",
    model: almaCodexModel(),
  };
  logins.set(sessionId, { child, status: initial, output: "" });
  child.stdout.on("data", (chunk: Buffer) => updateLoginOutput(sessionId, chunk));
  child.stderr.on("data", (chunk: Buffer) => updateLoginOutput(sessionId, chunk));
  child.on("error", (error) => {
    const active = logins.get(sessionId);
    if (active) active.status = { status: "error", connected: false, message: error.message, model: almaCodexModel() };
  });
  child.on("exit", async () => {
    const active = logins.get(sessionId);
    if (!active) return;
    const persisted = await persistedStatus(sessionId);
    if (persisted.connected) {
      active.status = persisted;
      return;
    }
    const rateLimited = /429|too many requests/i.test(active.output);
    active.status = {
      status: "error",
      connected: false,
      message: rateLimited
        ? "OpenAI temporarily rate-limited ChatGPT login. Wait a minute, then try again."
        : "ChatGPT login did not complete. Please try again.",
      model: almaCodexModel(),
    };
  });
  const expiry = setTimeout(() => {
    const active = logins.get(sessionId);
    if (active?.status.status === "pending") active.child.kill("SIGTERM");
  }, 16 * 60_000);
  expiry.unref();

  const startedAt = Date.now();
  // Device-code requests can take several seconds to complete on a cold CLI start.
  // Keep the initial request open long enough to return the URL/code directly;
  // subsequent UI polling still handles slower responses.
  while (Date.now() - startedAt < 20_000) {
    const state = logins.get(sessionId)?.status || initial;
    if (state.userCode || state.status === "error") return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return logins.get(sessionId)?.status || initial;
}

export async function logoutCodexSession(sessionId: string | null) {
  if (!sessionId || !validCodexSessionId(sessionId)) return;
  const active = logins.get(sessionId);
  if (active?.status.status === "pending") active.child.kill("SIGTERM");
  logins.delete(sessionId);
  try {
    await execFileAsync("codex", ["logout"], { env: codexEnvironment(sessionId), timeout: 5_000 });
  } catch {
    // Removing the isolated session directory below is the authoritative logout.
  }
  await rm(codexSessionHome(sessionId), { recursive: true, force: true });
}
