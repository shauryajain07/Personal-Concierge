#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { deleteAssignment, getAssignment, listAssignments } from "../lib/assignment-store";
import { clearFocusSessionsForDate, listFocusSessions } from "../lib/focus-session-store";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "../lib/task-store";

const userId = process.env.ALMA_USER_ID;
if (!userId) throw new Error("ALMA_USER_ID is required");

const server = new McpServer(
  { name: "alma-task-tools", version: "1.0.0" },
  { instructions: "Manage the current student's standalone tasks, assignment deletions, and scheduled calendar focus sessions. Orange focused-work blocks are study sessions, not standalone tasks. For requests about work on a calendar date, use the focus-session tools. Always resolve records before deleting; never guess IDs." },
);

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function run<T>(operation: () => T) {
  try { return result(operation()); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Task operation failed";
    return { ...result({ error: message }), isError: true };
  }
}

const status = z.enum(["pending", "completed"]);
const priority = z.enum(["low", "medium", "high"]);

server.registerTool("list_tasks", {
  title: "List or search tasks",
  description: "Return the current student's standalone Alma tasks and their exact IDs. Use this before get, edit, complete, or delete when the user refers to a task by title or description.",
  inputSchema: {
    query: z.string().optional().describe("Optional title or description search text"),
    status: status.optional(),
    courseId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, ({ query, status, courseId, limit }) => run(() => ({ tasks: listTasks(userId, { query, status, courseId, limit }) })));

server.registerTool("get_task", {
  title: "Get task",
  description: "Get one standalone Alma task by its exact ID.",
  inputSchema: { id: z.string().min(1) },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, ({ id }) => run(() => ({ task: getTask(userId, id) })));

server.registerTool("add_task", {
  title: "Add task",
  description: "Create a standalone Alma task and return its generated ID and complete saved record.",
  inputSchema: {
    title: z.string().min(1),
    description: z.string().optional(),
    dueAt: z.string().nullable().optional().describe("ISO 8601 date-time, or null for no deadline"),
    courseId: z.string().nullable().optional(),
    status: status.optional(),
    priority: priority.optional(),
    estimatedMinutes: z.number().int().min(5).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, (input) => run(() => ({ task: createTask(userId, input) })));

server.registerTool("edit_task", {
  title: "Edit task",
  description: "Update fields on an existing standalone Alma task by exact ID. This also completes or reopens a task through status.",
  inputSchema: {
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    dueAt: z.string().nullable().optional().describe("ISO 8601 date-time, or null to clear the deadline"),
    courseId: z.string().nullable().optional(),
    status: status.optional(),
    priority: priority.optional(),
    estimatedMinutes: z.number().int().min(5).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, ({ id, ...input }) => run(() => ({ task: updateTask(userId, id, input) })));

server.registerTool("delete_task", {
  title: "Delete task",
  description: "Permanently delete one standalone Alma task by exact ID. Resolve the ID with list_tasks first.",
  inputSchema: { id: z.string().min(1) },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
}, ({ id }) => run(() => deleteTask(userId, id)));

server.registerTool("list_assignments", {
  title: "List or search assignments",
  description: "Return academic assignments and exact IDs. Calendar focus sessions are linked to these assignment IDs. Search this when a requested deletion does not match a standalone task.",
  inputSchema: { query: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, ({ query, limit }) => run(() => ({ assignments: listAssignments(userId, query, limit) })));

server.registerTool("get_assignment", {
  title: "Get assignment",
  description: "Get one academic assignment by its exact ID.",
  inputSchema: { id: z.string().min(1) },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, ({ id }) => run(() => ({ assignment: getAssignment(userId, id) })));

server.registerTool("delete_assignment", {
  title: "Delete assignment and its focus sessions",
  description: "Permanently delete an academic assignment by exact ID. SQLite cascading also removes every calendar focus session linked to that assignment.",
  inputSchema: { id: z.string().min(1) },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
}, ({ id }) => run(() => deleteAssignment(userId, id)));

server.registerTool("list_focus_sessions", {
  title: "List calendar focus sessions",
  description: "List scheduled focused-work blocks, optionally for one Asia/Kolkata calendar date or one assignment. Use this when the student refers to tasks or orange work blocks visible on the calendar.",
  inputSchema: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Asia/Kolkata calendar date in YYYY-MM-DD format"),
    assignmentId: z.string().optional(),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, ({ date, assignmentId }) => run(() => ({ sessions: listFocusSessions(userId, { date, assignmentId }) })));

server.registerTool("clear_focus_sessions", {
  title: "Clear one day of calendar focus sessions",
  description: "Delete all planned focused-work blocks overlapping one Asia/Kolkata calendar date. This cleans that day without deleting assignments, standalone tasks, classes, or personal events.",
  inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Asia/Kolkata calendar date in YYYY-MM-DD format") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
}, ({ date }) => run(() => clearFocusSessionsForDate(userId, date)));

await server.connect(new StdioServerTransport());
