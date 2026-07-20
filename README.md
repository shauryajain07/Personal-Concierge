# Alma Academic OS

A standard full-stack Next.js and TypeScript application for managing a four-year academic program, courses, assignments, notes, grades, calendar commitments, study sessions, and AI-assisted planning.

## Stack

- Next.js App Router and React
- TypeScript on the client and server
- Node.js route handlers
- SQLite through `better-sqlite3`
- Server-side Codex SDK integration using local ChatGPT OAuth
- Local filesystem storage for uploaded assignment briefs

There are no Sites, Vinext, Cloudflare Worker, or browser-only persistence dependencies.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQL database and demo academic workspace are created automatically under `data/`. This folder is ignored by Git.

## Connect Codex OAuth

Select **Connect ChatGPT** inside Alma. Alma starts the official Codex device authorization flow and shows an OpenAI verification URL plus a one-time code. The student completes that flow using the ChatGPT account they want Alma to use.

Each browser receives an opaque, HttpOnly, SameSite cookie. Its Codex credentials are kept server-side in an isolated `CODEX_HOME` under `data/codex-sessions/`; OAuth credentials and access tokens are never returned to browser JavaScript. Logging out deletes that isolated credential directory.

No OpenAI API key is read or required. The server removes API-key and access-token environment variables before starting the Codex SDK, refuses to fall back to the host machine’s Codex login, and runs each academic reasoning task in a read-only, no-network Codex thread. Text-based PDFs are extracted locally; scanned PDFs are rendered into page images for Codex vision. If ChatGPT is disconnected, assignment capture and scheduling retain deterministic local fallbacks.

Alma defaults to `gpt-5.6-luna` with medium reasoning for the retrieval and answer stages. Set `ALMA_CODEX_MODEL` only when a deployment needs a different Codex model.

## Task API and Codex tools

Standalone tasks use one user-scoped service shared by the HTTP API, the planner fallback, and Alma's Codex MCP server. Every read or mutation is constrained by both task ID and the current user.

- `GET /api/tasks?query=&status=&courseId=&limit=` lists or searches tasks and returns their IDs.
- `POST /api/tasks` adds a task and returns the complete saved record.
- `GET /api/tasks/:id` gets one task.
- `PATCH /api/tasks/:id` or `PUT /api/tasks/:id` edits, completes, or reopens one task.
- `DELETE /api/tasks/:id` permanently deletes one task.

For workspace requests, Codex receives task tools, assignment lookup/deletion tools, and `list_focus_sessions` / `clear_focus_sessions` for date-specific calendar cleanup. It must resolve natural-language references before a deletion and ask for clarification when a match is ambiguous. The Codex thread remains filesystem-read-only and offline; only the scoped MCP tools can modify records.

## Relevance-based AI retrieval

Planner chat and chat assignment analysis use two stages:

1. Codex receives the current date, timezone, latest request, at most eight follow-up messages, and a compact metadata index. The index contains IDs, titles/names, course codes, statuses, dates, and note tags—never note bodies, assignment descriptions, grade history, calendar contents, credentials, or uploaded document text.
2. The resulting strict retrieval plan drives parameterized, user-scoped SQLite queries. Only the selected records are sent to the answering call. Schedule requests retrieve incomplete assignments, fixed commitments, and existing sessions inside the bounded planning window; explicit course and assignment mentions are retained even outside that window.

Retrieved data is limited to 40 assignments, 32 courses, 6 notes, 60 grades, 120 fixed events, 120 study sessions, and 16 historical semesters. Note bodies are truncated to 2,000 characters and assignment descriptions to 1,200 characters. Historical semesters and grades are excluded unless the request needs them. In development, API responses include ID/count-only retrieval diagnostics; record bodies and OAuth data are never logged.

## Verification

```bash
npm run build
npm test
npm run lint
```

## Production notes

The included storage adapters target a local or single-server Node deployment. Before horizontal scaling, replace SQLite with PostgreSQL and local uploads with S3-compatible object storage. Keep the API contracts and client UI unchanged.
