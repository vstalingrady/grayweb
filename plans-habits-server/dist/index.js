#!/usr/bin/env node
// plans-habits-server MCP:
// - Local stdio MCP server for CRUD on plans and habits via existing backend.
// - Expects dependencies to be installed in this package:
//     npm install @modelcontextprotocol/sdk zod
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
/**
 * MCP server: plans-habits-server
 *
 * Purpose:
 * - Let the AI list/create/update/delete real plans and habits
 *   via your existing backend (FastAPI in backend/main.py:437+).
 *
 * Design:
 * - Uses stdio transport (local MCP server).
 * - Talks to backend via HTTP using a fixed base URL configured
 *   via environment variables.
 *
 * Required MCP env (configure in mcp_settings.json):
 * - PLANS_BACKEND_BASE_URL:
 *     Base URL for your FastAPI app.
 *     e.g. "http://localhost:8000" in dev or your deployed URL.
 *
 * - PLANS_HABITS_API_KEY (optional):
 *     If you later secure these endpoints with a token/header,
 *     this server can send it as Authorization: Bearer ...
 *
 * Server assumptions:
 * - Backend routes as implemented in backend/main.py:
 *     GET    /users/{user_id}/plans
 *     POST   /users/{user_id}/plans
 *     PATCH  /users/{user_id}/plans/{plan_id}
 *     DELETE /users/{user_id}/plans/{plan_id}
 *     GET    /users/{user_id}/habits
 *     POST   /users/{user_id}/habits
 *     PATCH  /users/{user_id}/habits/{habit_id}
 *     DELETE /users/{user_id}/habits/{habit_id}
 *
 * IMPORTANT:
 * - The tools here are low-level and deterministic; they map directly
 *   to your backend semantics so the AI can treat them as authoritative.
 */
const BASE_URL = (process.env.PLANS_BACKEND_BASE_URL || "").trim().replace(/\/+$/, "") ||
    "http://localhost:8000";
const AUTH_TOKEN = (process.env.PLANS_HABITS_API_KEY || "").trim();
/**
 * Basic typed fetch wrapper for this MCP server.
 */
async function backendFetch(path, init = {}) {
    const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = {
        ...init.headers,
    };
    if (!("Content-Type" in headers) && init.body && !(init.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    if (AUTH_TOKEN && !("Authorization" in headers)) {
        headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
    }
    const response = await fetch(url, {
        ...init,
        headers,
    });
    let bodyText = null;
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
        try {
            bodyText = await response.text();
        }
        catch {
            bodyText = null;
        }
        const detail = (bodyText && safeParseJson(bodyText)?.detail) ||
            bodyText ||
            `HTTP ${response.status}`;
        throw new Error(`Backend error for ${init.method || "GET"} ${url}: ${detail}`);
    }
    if (!contentType.includes("application/json")) {
        return null;
    }
    try {
        return await response.json();
    }
    catch (error) {
        throw new Error(`Failed to parse JSON from ${url}: ${error.message}`);
    }
}
function safeParseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
const server = new McpServer({
    name: "plans-habits-server",
    version: "0.1.0",
});
/**
 * Zod schemas for tool args
 */
const UserIdSchema = z
    .number()
    .int()
    .positive()
    .describe("Numeric user id. The caller must provide the correct user id.");
const PlanIdSchema = z
    .number()
    .int()
    .positive()
    .describe("Numeric plan id from the backend.");
const HabitIdSchema = z
    .number()
    .int()
    .positive()
    .describe("Numeric habit id from the backend.");
/**
 * Tools: Plans
 */
/**
 * list_plans
 * - List all plans for a user.
 */
server.tool("list_plans", {
    user_id: UserIdSchema,
}, async ({ user_id }) => {
    const data = await backendFetch(`/users/${user_id}/plans`, {
        method: "GET",
    });
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    user_id,
                    plans: data ?? [],
                }, null, 2),
            },
        ],
    };
});
/**
 * create_plan
 * - Create a new plan for a user.
 */
server.tool("create_plan", {
    user_id: UserIdSchema,
    label: z
        .string()
        .min(1)
        .describe("Human-readable description of the plan."),
    completed: z
        .boolean()
        .optional()
        .describe("Whether the plan is already completed. Defaults to false."),
    deadline: z
        .string()
        .nullable()
        .optional()
        .describe("Optional deadline (ISO 8601 date or datetime). Null/omit if not set."),
    schedule_slot: z
        .string()
        .nullable()
        .optional()
        .describe('Optional schedule window as "HH:MM-HH:MM" or similar. Null/omit if not set.'),
    description: z
        .string()
        .nullable()
        .optional()
        .describe("Optional longer notes/description for the plan."),
}, async ({ user_id, label, completed = false, deadline = null, schedule_slot = null, description = null, }) => {
    const payload = {
        label,
        completed,
        deadline,
        schedule_slot,
        description,
    };
    const created = await backendFetch(`/users/${user_id}/plans`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    user_id,
                    plan: created,
                }, null, 2),
            },
        ],
    };
});
/**
 * update_plan
 * - Patch an existing plan (label/completed/deadline/schedule_slot/description).
 */
server.tool("update_plan", {
    user_id: UserIdSchema,
    plan_id: PlanIdSchema,
    label: z
        .string()
        .optional()
        .describe("New label for the plan (omit to keep existing)."),
    completed: z
        .boolean()
        .optional()
        .describe("Update completion status (omit to keep existing)."),
    deadline: z
        .string()
        .nullable()
        .optional()
        .describe("New deadline (ISO 8601) or null to clear. Omit field to leave unchanged."),
    schedule_slot: z
        .string()
        .nullable()
        .optional()
        .describe('New schedule window string or null to clear. Omit to leave unchanged.'),
    description: z
        .string()
        .nullable()
        .optional()
        .describe("New description string or null to clear. Omit to leave unchanged."),
}, async (args) => {
    const { user_id, plan_id, label, completed, deadline, schedule_slot, description, } = args;
    const payload = {};
    if (typeof label === "string")
        payload.label = label;
    if (typeof completed === "boolean")
        payload.completed = completed;
    if (Object.prototype.hasOwnProperty.call(args, "deadline")) {
        payload.deadline = deadline;
    }
    if (Object.prototype.hasOwnProperty.call(args, "schedule_slot")) {
        payload.schedule_slot = schedule_slot;
    }
    if (Object.prototype.hasOwnProperty.call(args, "description")) {
        payload.description = description;
    }
    if (Object.keys(payload).length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No fields provided to update_plan; nothing changed.",
                },
            ],
        };
    }
    const updated = await backendFetch(`/users/${user_id}/plans/${plan_id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    user_id,
                    plan_id,
                    plan: updated,
                }, null, 2),
            },
        ],
    };
});
/**
 * delete_plan
 * - Delete a plan by id.
 */
server.tool("delete_plan", {
    user_id: UserIdSchema,
    plan_id: PlanIdSchema,
}, async ({ user_id, plan_id }) => {
    await backendFetch(`/users/${user_id}/plans/${plan_id}`, {
        method: "DELETE",
    });
    return {
        content: [
            {
                type: "text",
                text: `Deleted plan ${plan_id} for user ${user_id}.`,
            },
        ],
    };
});
/**
 * Tools: Habits
 */
/**
 * list_habits
 * - List habits for a user.
 */
server.tool("list_habits", {
    user_id: UserIdSchema,
}, async ({ user_id }) => {
    const data = await backendFetch(`/users/${user_id}/habits`, {
        method: "GET",
    });
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    user_id,
                    habits: data ?? [],
                }, null, 2),
            },
        ],
    };
});
/**
 * create_habit
 * - Create a new habit for a user.
 */
server.tool("create_habit", {
    user_id: UserIdSchema,
    label: z
        .string()
        .min(1)
        .describe("Name/label of the habit."),
    streak_label: z
        .string()
        .optional()
        .describe('Optional initial streak label, e.g. "0 days". Defaults based on backend.'),
    previous_label: z
        .string()
        .optional()
        .describe('Optional previous label, e.g. "No history yet". Defaults based on backend.'),
    description: z
        .string()
        .nullable()
        .optional()
        .describe("Optional description/notes for the habit."),
}, async ({ user_id, label, streak_label, previous_label, description = null, }) => {
    const payload = {
        label,
    };
    if (typeof streak_label === "string") {
        payload.streak_label = streak_label;
    }
    if (typeof previous_label === "string") {
        payload.previous_label = previous_label;
    }
    if (description !== undefined) {
        payload.description = description;
    }
    const created = await backendFetch(`/users/${user_id}/habits`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    user_id,
                    habit: created,
                }, null, 2),
            },
        ],
    };
});
/**
 * update_habit
 * - Patch an existing habit.
 */
server.tool("update_habit", {
    user_id: UserIdSchema,
    habit_id: HabitIdSchema,
    label: z
        .string()
        .optional()
        .describe("New label (omit to keep existing)."),
    streak_label: z
        .string()
        .nullable()
        .optional()
        .describe('New streak label string or null to clear (omit to keep existing).'),
    previous_label: z
        .string()
        .nullable()
        .optional()
        .describe('New previous label or null to clear (omit to keep existing).'),
    description: z
        .string()
        .nullable()
        .optional()
        .describe("New description or null to clear (omit to keep existing)."),
}, async (args) => {
    const { user_id, habit_id, label, streak_label, previous_label, description, } = args;
    const payload = {};
    if (typeof label === "string")
        payload.label = label;
    if (Object.prototype.hasOwnProperty.call(args, "streak_label")) {
        payload.streak_label = streak_label;
    }
    if (Object.prototype.hasOwnProperty.call(args, "previous_label")) {
        payload.previous_label = previous_label;
    }
    if (Object.prototype.hasOwnProperty.call(args, "description")) {
        payload.description = description;
    }
    if (Object.keys(payload).length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No fields provided to update_habit; nothing changed.",
                },
            ],
        };
    }
    const updated = await backendFetch(`/users/${user_id}/habits/${habit_id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    user_id,
                    habit_id,
                    habit: updated,
                }, null, 2),
            },
        ],
    };
});
/**
 * delete_habit
 * - Delete a habit by id.
 */
server.tool("delete_habit", {
    user_id: UserIdSchema,
    habit_id: HabitIdSchema,
}, async ({ user_id, habit_id }) => {
    await backendFetch(`/users/${user_id}/habits/${habit_id}`, {
        method: "DELETE",
    });
    return {
        content: [
            {
                type: "text",
                text: `Deleted habit ${habit_id} for user ${user_id}.`,
            },
        ],
    };
});
/**
 * bootstrap_status
 * - Simple diagnostic to confirm server wiring from the AI side.
 */
server.tool("bootstrap_status", {}, async () => {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    server: "plans-habits-server",
                    base_url: BASE_URL,
                    auth_configured: Boolean(AUTH_TOKEN),
                    tools: [
                        "list_plans",
                        "create_plan",
                        "update_plan",
                        "delete_plan",
                        "list_habits",
                        "create_habit",
                        "update_habit",
                        "delete_habit",
                    ],
                }, null, 2),
            },
        ],
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start plans-habits-server MCP:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map