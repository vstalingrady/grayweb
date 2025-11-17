#!/usr/bin/env node
// Minimal, working MCP server for plans/habits.
// Uses only the generic Server API from @modelcontextprotocol/sdk/server/index.js
// and manual stdio wiring (no server.connect()), so it matches the installed SDK
// and avoids the onclose/transport issues.
// All code + config live in this repo, so it works anywhere you clone it.
import { z } from "zod";
// Backend configuration
const BACKEND_BASE_URL = (process.env.PLANS_BACKEND_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const API_KEY = process.env.PLANS_HABITS_API_KEY || "";
// Basic fetch wrapper
async function backendFetch(path, init = {}) {
    const url = `${BACKEND_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = {
        ...init.headers,
    };
    if (!("Content-Type" in headers) && init.body && !(init.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    if (API_KEY && !("Authorization" in headers)) {
        headers["Authorization"] = `Bearer ${API_KEY}`;
    }
    const res = await fetch(url, { ...init, headers });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    }
    catch {
        // ignore non-JSON
    }
    if (!res.ok) {
        const detail = (json && (json.detail || json.error || json.message)) ||
            text ||
            `HTTP ${res.status}`;
        throw new Error(`Backend error ${res.status} for ${url}: ${detail}`);
    }
    return json;
}
// Zod schemas
const ListPlansArgs = z.object({
    user_id: z.number().int().positive(),
});
const CreatePlanArgs = z.object({
    user_id: z.number().int().positive(),
    label: z.string().min(1),
    completed: z.boolean().optional(),
    deadline: z.string().nullable().optional(),
    schedule_slot: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
});
const ListHabitsArgs = z.object({
    user_id: z.number().int().positive(),
});
const CreateHabitArgs = z.object({
    user_id: z.number().int().positive(),
    label: z.string().min(1),
    streak_label: z.string().optional(),
    previous_label: z.string().optional(),
    description: z.string().nullable().optional(),
});
const UpdatePlanArgs = z.object({
    user_id: z.number().int().positive(),
    plan_id: z.number().int().positive(),
    label: z.string().optional(),
    completed: z.boolean().optional(),
    deadline: z.string().nullable().optional(),
    schedule_slot: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
});
const DeletePlanArgs = z.object({
    user_id: z.number().int().positive(),
    plan_id: z.number().int().positive(),
});
const UpdateHabitArgs = z.object({
    user_id: z.number().int().positive(),
    habit_id: z.number().int().positive(),
    label: z.string().optional(),
    streak_label: z.string().nullable().optional(),
    previous_label: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
});
const DeleteHabitArgs = z.object({
    user_id: z.number().int().positive(),
    habit_id: z.number().int().positive(),
});
const ListRemindersArgs = z.object({
    user_id: z.number().int().positive(),
    status: z.string().optional(),
    limit: z.number().int().positive().optional(),
});
const CreateReminderArgs = z.object({
    user_id: z.number().int().positive(),
    label: z.string().min(1),
    remind_at: z.string().min(3),
    description: z.string().nullable().optional(),
    entity_type: z.string().optional(),
    entity_id: z.number().int().positive().optional(),
    metadata: z.record(z.any()).optional(),
});
const UpdateReminderArgs = z.object({
    user_id: z.number().int().positive(),
    reminder_id: z.number().int().positive(),
    label: z.string().optional(),
    description: z.string().nullable().optional(),
    remind_at: z.string().optional(),
    status: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});
const DeleteReminderArgs = z.object({
    user_id: z.number().int().positive(),
    reminder_id: z.number().int().positive(),
});
// Main MCP server bootstrap
(async () => {
    // Import Server from SDK index (this path exists in the installed SDK)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
    const server = new Server({
        name: "plans-habits-server",
        version: "0.1.0",
    }, {
        capabilities: {
            tools: { listChanged: false },
            prompts: { listChanged: false },
            resources: { listChanged: false },
        },
    });
    // tools/list
    server.setRequestHandler(
    // Schema for tools/list
    z.object({
        method: z.literal("tools/list"),
    }), async () => ({
        tools: [
            {
                name: "bootstrap_status",
                description: "Check MCP server status and configured backend URL",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "list_plans",
                description: "List plans for a user",
                inputSchema: {
                    type: "object",
                    properties: { user_id: { type: "number" } },
                    required: ["user_id"],
                },
            },
            {
                name: "create_plan",
                description: "Create a plan for a user",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        label: { type: "string" },
                        completed: { type: "boolean" },
                        deadline: { type: "string", nullable: true },
                        schedule_slot: { type: "string", nullable: true },
                        description: { type: "string", nullable: true },
                    },
                    required: ["user_id", "label"],
                },
            },
            {
                name: "update_plan",
                description: "Update a plan for a user",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        plan_id: { type: "number" },
                        label: { type: "string" },
                        completed: { type: "boolean" },
                        deadline: { type: "string", nullable: true },
                        schedule_slot: { type: "string", nullable: true },
                        description: { type: "string", nullable: true },
                    },
                    required: ["user_id", "plan_id"],
                },
            },
            {
                name: "delete_plan",
                description: "Delete a plan for a user",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        plan_id: { type: "number" },
                    },
                    required: ["user_id", "plan_id"],
                },
            },
            {
                name: "list_habits",
                description: "List habits for a user",
                inputSchema: {
                    type: "object",
                    properties: { user_id: { type: "number" } },
                    required: ["user_id"],
                },
            },
            {
                name: "create_habit",
                description: "Create a habit for a user",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        label: { type: "string" },
                        streak_label: { type: "string" },
                        previous_label: { type: "string" },
                        description: { type: "string", nullable: true },
                    },
                    required: ["user_id", "label"],
                },
            },
            {
                name: "update_habit",
                description: "Update a habit for a user",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        habit_id: { type: "number" },
                        label: { type: "string" },
                        streak_label: { type: "string", nullable: true },
                        previous_label: { type: "string", nullable: true },
                        description: { type: "string", nullable: true },
                    },
                    required: ["user_id", "habit_id"],
                },
            },
            {
                name: "delete_habit",
                description: "Delete a habit for a user",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        habit_id: { type: "number" },
                    },
                    required: ["user_id", "habit_id"],
                },
            },
            {
                name: "list_reminders",
                description: "List reminders for a user (supports optional status/limit).",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        status: { type: "string" },
                        limit: { type: "number" },
                    },
                    required: ["user_id"],
                },
            },
            {
                name: "create_reminder",
                description: "Create a reminder entry for a user.",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        label: { type: "string" },
                        remind_at: { type: "string" },
                        description: { type: "string", nullable: true },
                        entity_type: { type: "string" },
                        entity_id: { type: "number" },
                        metadata: { type: "object" },
                    },
                    required: ["user_id", "label", "remind_at"],
                },
            },
            {
                name: "update_reminder",
                description: "Update reminder metadata/status/timing.",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        reminder_id: { type: "number" },
                        label: { type: "string" },
                        description: { type: "string", nullable: true },
                        remind_at: { type: "string" },
                        status: { type: "string" },
                        metadata: { type: "object" },
                    },
                    required: ["user_id", "reminder_id"],
                },
            },
            {
                name: "delete_reminder",
                description: "Delete a reminder for a user.",
                inputSchema: {
                    type: "object",
                    properties: {
                        user_id: { type: "number" },
                        reminder_id: { type: "number" },
                    },
                    required: ["user_id", "reminder_id"],
                },
            },
        ],
    }));
    // tools/call
    server.setRequestHandler(z.object({
        method: z.literal("tools/call"),
        params: z.object({
            name: z.string(),
            arguments: z.record(z.any()).optional(),
        }),
    }), async (req) => {
        const { name, arguments: rawArgs = {} } = req.params || {};
        const args = rawArgs;
        switch (name) {
            case "bootstrap_status": {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                server: "plans-habits-server",
                                base_url: BACKEND_BASE_URL,
                                auth_configured: Boolean(API_KEY),
                                tools: [
                                    "bootstrap_status",
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
            }
            case "list_plans": {
                const parsed = ListPlansArgs.parse(args);
                const plans = await backendFetch(`/users/${parsed.user_id}/plans`, {
                    method: "GET",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, plans: plans ?? [] }, null, 2),
                        },
                    ],
                };
            }
            case "create_plan": {
                const parsed = CreatePlanArgs.parse(args);
                const payload = {
                    label: parsed.label,
                    completed: parsed.completed ?? false,
                    deadline: parsed.deadline ?? null,
                    schedule_slot: parsed.schedule_slot ?? null,
                    description: parsed.description ?? null,
                };
                const created = await backendFetch(`/users/${parsed.user_id}/plans`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, plan: created }, null, 2),
                        },
                    ],
                };
            }
            case "update_plan": {
                const parsed = UpdatePlanArgs.parse(args);
                const payload = {};
                if (parsed.label !== undefined)
                    payload.label = parsed.label;
                if (parsed.completed !== undefined)
                    payload.completed = parsed.completed;
                if (parsed.deadline !== undefined)
                    payload.deadline = parsed.deadline;
                if (parsed.schedule_slot !== undefined)
                    payload.schedule_slot = parsed.schedule_slot;
                if (parsed.description !== undefined)
                    payload.description = parsed.description;
                const updated = await backendFetch(`/users/${parsed.user_id}/plans/${parsed.plan_id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, plan: updated }, null, 2),
                        },
                    ],
                };
            }
            case "delete_plan": {
                const parsed = DeletePlanArgs.parse(args);
                await backendFetch(`/users/${parsed.user_id}/plans/${parsed.plan_id}`, {
                    method: "DELETE",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                user_id: parsed.user_id,
                                plan_id: parsed.plan_id,
                                deleted: true,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "list_habits": {
                const parsed = ListHabitsArgs.parse(args);
                const habits = await backendFetch(`/users/${parsed.user_id}/habits`, {
                    method: "GET",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, habits: habits ?? [] }, null, 2),
                        },
                    ],
                };
            }
            case "create_habit": {
                const parsed = CreateHabitArgs.parse(args);
                const payload = {
                    label: parsed.label,
                };
                if (parsed.streak_label)
                    payload.streak_label = parsed.streak_label;
                if (parsed.previous_label)
                    payload.previous_label = parsed.previous_label;
                if (parsed.description !== undefined)
                    payload.description = parsed.description;
                const created = await backendFetch(`/users/${parsed.user_id}/habits`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, habit: created }, null, 2),
                        },
                    ],
                };
            }
            case "update_habit": {
                const parsed = UpdateHabitArgs.parse(args);
                const payload = {};
                if (parsed.label !== undefined)
                    payload.label = parsed.label;
                if (parsed.streak_label !== undefined)
                    payload.streak_label = parsed.streak_label;
                if (parsed.previous_label !== undefined)
                    payload.previous_label = parsed.previous_label;
                if (parsed.description !== undefined)
                    payload.description = parsed.description;
                const habit = await backendFetch(`/users/${parsed.user_id}/habits/${parsed.habit_id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, habit }, null, 2),
                        },
                    ],
                };
            }
            case "delete_habit": {
                const parsed = DeleteHabitArgs.parse(args);
                await backendFetch(`/users/${parsed.user_id}/habits/${parsed.habit_id}`, {
                    method: "DELETE",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                user_id: parsed.user_id,
                                habit_id: parsed.habit_id,
                                deleted: true,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "list_reminders": {
                const parsed = ListRemindersArgs.parse(args);
                const queryParams = new URLSearchParams();
                if (parsed.status)
                    queryParams.set("status_filter", parsed.status);
                if (parsed.limit)
                    queryParams.set("limit", String(parsed.limit));
                const query = queryParams.toString();
                const reminders = await backendFetch(`/users/${parsed.user_id}/reminders${query ? `?${query}` : ""}`, { method: "GET" });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, reminders: reminders ?? [] }, null, 2),
                        },
                    ],
                };
            }
            case "create_reminder": {
                const parsed = CreateReminderArgs.parse(args);
                const payload = {
                    label: parsed.label,
                    remind_at: parsed.remind_at,
                };
                if (parsed.description !== undefined)
                    payload.description = parsed.description;
                if (parsed.entity_type)
                    payload.entity_type = parsed.entity_type;
                if (parsed.entity_id)
                    payload.entity_id = parsed.entity_id;
                if (parsed.metadata)
                    payload.metadata = parsed.metadata;
                const reminder = await backendFetch(`/users/${parsed.user_id}/reminders`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, reminder }, null, 2),
                        },
                    ],
                };
            }
            case "update_reminder": {
                const parsed = UpdateReminderArgs.parse(args);
                const payload = {};
                if (parsed.label !== undefined)
                    payload.label = parsed.label;
                if (parsed.description !== undefined)
                    payload.description = parsed.description;
                if (parsed.remind_at !== undefined)
                    payload.remind_at = parsed.remind_at;
                if (parsed.status !== undefined)
                    payload.status = parsed.status;
                if (parsed.metadata !== undefined)
                    payload.metadata = parsed.metadata;
                const reminder = await backendFetch(`/users/${parsed.user_id}/reminders/${parsed.reminder_id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ user_id: parsed.user_id, reminder }, null, 2),
                        },
                    ],
                };
            }
            case "delete_reminder": {
                const parsed = DeleteReminderArgs.parse(args);
                await backendFetch(`/users/${parsed.user_id}/reminders/${parsed.reminder_id}`, {
                    method: "DELETE",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                user_id: parsed.user_id,
                                reminder_id: parsed.reminder_id,
                                deleted: true,
                            }, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    });
    // Manual stdio wiring to avoid the connect()/onclose bug.
    // This reads JSON-RPC from stdin, passes to server, and writes responses to stdout.
    process.stdin.setEncoding("utf8");
    let buffer = "";
    process.stdin.on("data", async (chunk) => {
        buffer += chunk;
        // Messages are newline-delimited JSON
        let index;
        // eslint-disable-next-line no-cond-assign
        while ((index = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + 1);
            if (!line)
                continue;
            try {
                const message = JSON.parse(line);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore - server.request has loosely typed signatures in this SDK
                const response = await server.request(message);
                if (response) {
                    process.stdout.write(JSON.stringify(response) + "\n");
                }
            }
            catch (err) {
                // Log but don't crash; this keeps the server robust.
                console.error("Failed to handle MCP message:", err);
            }
        }
    });
    process.stdin.on("end", () => {
        process.exit(0);
    });
})().catch((err) => {
    console.error("Failed to start plans-habits MCP server:", err);
    process.exit(1);
});
