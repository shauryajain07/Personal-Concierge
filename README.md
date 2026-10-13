# Alma Academic OS

Alma is a personal academic workspace for courses, assignments, notes, grades, calendar commitments, study sessions, and AI-assisted planning.

It started from a practical frustration. University life puts deadlines in one place, notes in another, grades in a spreadsheet, and available time on a calendar. None of those systems answer the question that matters most:

> What should I work on right now?

Alma models those pieces together so planning can be based on urgency, context, study history, and available time rather than a manually maintained list.

## Core capabilities

- Manage courses, assignments, notes, grades, calendar commitments, and study sessions.
- Attach assignment briefs and extract text locally, including scanned PDFs through rendered pages.
- Search and retrieve relevant academic records before planning.
- Save explicit study preferences, goals, and constraints for future Codex planning.
- Choose which course notes and saved memories Codex can use, and inspect a source receipt after each answer.
- Produce focused study plans instead of sending the entire workspace to a model.
- Support task creation, editing, completion, reopening, and deletion through scoped APIs.
- Keep each browser session isolated with server-side credentials and an HttpOnly cookie.

## How planning works

Alma uses a two-stage retrieval flow:

1. A read-only reasoning step receives the current request, recent conversation, and a compact metadata index.
2. The selected records are fetched through parameterized, user-scoped SQLite queries and passed to the answering step.

The metadata index intentionally excludes note and memory bodies, assignment descriptions, grades, calendar contents, credentials, and uploaded document text unless those records are selected for the bounded planning window.

## Memory and context controls

- Saved memories are written only when you add them in **Memory**. Alma does not infer or save memories from chat.
- Each memory can be edited, paused, or deleted. Only enabled memories selected for the current request are sent to Codex, with a limit of eight memories and 600 characters per memory.
- Each note has a **Use in Codex context** control. Paused notes are excluded from both the metadata index and retrieved context.
- Chat transcripts remain in that browser's local storage. At most eight recent messages are included when resolving a follow-up; transcripts are separate from saved memories.
- After an answer, **Context used** lists the selected memories, notes, courses, assignments, commitments, sessions, grades, and recent message count.
- Academic records and saved memories live in the local SQLite database. When Codex is connected, Alma sends only the selected records needed for the request.

## Stack

- Next.js App Router, React, and TypeScript
- Node.js route handlers
- SQLite through `better-sqlite3`
- Server-side Codex SDK integration through local ChatGPT OAuth
- Local filesystem storage for uploaded assignment briefs

No OpenAI API key is required. When connected, Alma uses the official Codex device authorization flow. Retrieval planning and workspace reasoning use read-only Codex calls; if the connection is unavailable, deterministic local fallbacks keep assignment capture and scheduling usable.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The local SQLite database is created under the ignored `data/` directory. A new workspace starts empty; courses, assignments, notes, grades, events, study sessions, tasks, and memories appear only after you add or create them. Alma does not currently sync with a university SIS, LMS, or external calendar; enter your own records in the app. Set `ALMA_DB_PATH` to keep the database outside the repository workspace.

## Verification

```bash
npm run build
npm test
npm run lint
```

The included storage adapters target a local or single-server deployment. A horizontally scaled deployment should replace SQLite with PostgreSQL and local uploads with S3-compatible object storage while keeping the API contracts intact.
