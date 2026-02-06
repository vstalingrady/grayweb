import { resolveApiBaseUrl } from "./baseUrl";
import { buildBodyPreview } from "./utils";
import { getSupabaseAccessToken } from "../auth/supabaseAccessToken";
import type { ChatRequest, ChatStreamEvent, ChatStreamTiming } from "./types";

export async function* sendChatMessageStream(
  request: ChatRequest,
  options?: { signal?: AbortSignal },
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  type UsagePayload = Extract<ChatStreamEvent, { type: "usage" }>["usage"];
  type GroundingMetadataPayload = Extract<ChatStreamEvent, { type: "end" }>["groundingMetadata"];

  const coerceUsagePayload = (candidate: unknown): UsagePayload | null => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }
    const record = candidate as Record<string, unknown>;
    const completionTokens = record["completion_tokens"] ?? record["completionTokens"];
    const promptTokens = record["prompt_tokens"] ?? record["promptTokens"];
    const totalTokens = record["total_tokens"] ?? record["totalTokens"];
    const totalCost = record["total_cost"] ?? record["totalCost"];

    if (
      typeof completionTokens !== "number" ||
      typeof promptTokens !== "number" ||
      typeof totalTokens !== "number"
    ) {
      return null;
    }

    const usage: UsagePayload = {
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens,
      total_tokens: totalTokens,
    };
    if (typeof totalCost === "number") {
      usage.total_cost = totalCost;
    }
    return usage;
  };

  const baseUrl = resolveApiBaseUrl();
  const endpoint = "/api/chat/stream";
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const shouldLogVerbose = process.env.NEXT_PUBLIC_ENABLE_API_LOGGING === "true";

  if (shouldLogVerbose) {
    console.debug("[ApiService.sendMessageStream:start]", {
      requestId,
      endpoint,
      baseUrl,
      url,
      usesProxy: baseUrl.startsWith("/api/"),
      bodyPreview: buildBodyPreview(request),
    });
  }

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };

  const token = await getSupabaseAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const requestBody = JSON.stringify(request);
  const requestInit = {
    method: "POST",
    headers,
    body: requestBody,
    signal: options?.signal,
  };

  let response = await fetch(url, requestInit);

  if (response.status === 401 && headers["Authorization"]) {
    const refreshedToken = await getSupabaseAccessToken({ forceRefresh: true });
    if (refreshedToken) {
      headers["Authorization"] = `Bearer ${refreshedToken}`;
      response = await fetch(url, requestInit);
    } else {
      delete headers["Authorization"];
      response = await fetch(url, requestInit);
    }
  }

  if (!response.ok) {
    let detail = `HTTP error! status: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        detail = payload.detail;
      }
    } catch {
      // Best effort - non JSON payloads fall back to default message.
    }
    if (shouldLogVerbose) {
      console.error("[ApiService.sendMessageStream:response-error]", {
        requestId,
        endpoint,
        url,
        status: response.status,
        statusText: response.statusText,
        detail,
      });
    }
    throw new Error(detail);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    yield {
      type: "end",
      conversationId: payload?.conversation_id ?? payload?.conversationId ?? null,
      response: payload?.response ?? payload?.text ?? "",
      title: payload?.title ?? null,
      groundingMetadata: payload?.grounding_metadata ?? payload?.groundingMetadata ?? null,
    };
    return;
  }

  if (!response.body) {
    throw new Error("Streaming response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const newlineRegex = /\r?\n/;
  const eventPrefix = "event:";
  const dataPrefix = "data:";
  const eventPrefixLength = eventPrefix.length;
  const dataPrefixLength = dataPrefix.length;

  type StreamPayload = Record<string, unknown> & {
    delta?: string;
    token?: string;
    text?: string;
    conversation_id?: string;
    conversationId?: string;
    response?: string;
    title?: string | null;
    grounding_metadata?: unknown;
    groundingMetadata?: unknown;
    message?: string;
    error?: string;
    reminders?: unknown[];
    usage?: unknown;
    timing?: {
      total_ms?: number;
      first_token_ms?: number;
      totalMs?: number;
      firstTokenMs?: number;
    };
  };

  const parseSseEvent = (chunk: string): ChatStreamEvent | null => {
    const lines = chunk.split(newlineRegex);
    let eventType = "message";
    const dataLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line[0] === ":") {
        continue;
      }
      if (line.startsWith(eventPrefix)) {
        eventType = line.slice(eventPrefixLength).trim() || eventType;
      } else if (line.startsWith(dataPrefix)) {
        let value = line.slice(dataPrefixLength);
        if (value.startsWith(" ")) {
          value = value.slice(1);
        }
        dataLines.push(value);
      }
    }

    const dataString = dataLines.join("\n");
    if (!dataString) {
      return null;
    }

    let payload: StreamPayload;
    try {
      payload = JSON.parse(dataString);
    } catch {
      payload = { delta: dataString };
    }

    if (eventType === "token") {
      const delta = payload.delta ?? payload.token ?? payload.text ?? "";
      return delta ? { type: "token", delta } : null;
    }

    if (eventType === "end") {
      const groundingCandidate = payload.grounding_metadata ?? payload.groundingMetadata ?? null;
      return {
        type: "end",
        conversationId: payload.conversation_id ?? payload.conversationId ?? null,
        response: payload.response ?? payload.text ?? "",
        title: payload.title ?? null,
        groundingMetadata: groundingCandidate as GroundingMetadataPayload,
        timing: (() => {
          const rawTiming = payload.timing;
          if (!rawTiming) {
            return undefined;
          }
          const totalMs =
            typeof rawTiming.total_ms === "number"
              ? rawTiming.total_ms
              : typeof rawTiming.totalMs === "number"
                ? rawTiming.totalMs
                : undefined;
          if (typeof totalMs !== "number" || !Number.isFinite(totalMs)) {
            return undefined;
          }
          const firstTokenMs =
            typeof rawTiming.first_token_ms === "number"
              ? rawTiming.first_token_ms
              : typeof rawTiming.firstTokenMs === "number"
                ? rawTiming.firstTokenMs
                : undefined;
          const timing: ChatStreamTiming = { totalMs };
          if (typeof firstTokenMs === "number" && Number.isFinite(firstTokenMs)) {
            timing.firstTokenMs = firstTokenMs;
          }
          return timing;
        })(),
      };
    }

    if (eventType === "error") {
      return {
        type: "error",
        message: payload.message ?? payload.error ?? "Stream error",
      };
    }

    if (eventType === "reminders") {
      const reminders = payload.reminders;
      if (Array.isArray(reminders)) {
        return {
          type: "reminders",
          reminders,
        };
      }
      return null;
    }

    if (eventType === "tool_status") {
      const nameCandidate = payload.name ?? payload.tool ?? payload.tool_name ?? payload.toolName;
      if (typeof nameCandidate !== "string" || !nameCandidate.trim()) {
        return null;
      }
      const statusCandidate = payload.status ?? payload.state ?? payload.phase;
      const normalizedStatus =
        typeof statusCandidate === "string" && statusCandidate.toLowerCase() === "end" ? "end" : "start";
      const queryCandidate =
        payload.query ??
        payload.search_query ??
        payload.searchQuery ??
        payload.q;
      return {
        type: "tool_status",
        name: nameCandidate.trim(),
        status: normalizedStatus,
        query: typeof queryCandidate === "string" ? queryCandidate.trim() || undefined : undefined,
      };
    }

    if (eventType === "usage") {
      const usage = coerceUsagePayload(payload.usage);
      return usage ? { type: "usage", usage } : null;
    }

    const fallbackDelta = payload.delta ?? payload.token ?? payload.text;
    if (typeof fallbackDelta !== "string" || !fallbackDelta) {
      return null;
    }
    return { type: "token", delta: fallbackDelta };
  };

  const flushBuffer = (): ChatStreamEvent[] => {
    const events: ChatStreamEvent[] = [];
    while (true) {
      const doubleNewlineIndex = buffer.indexOf("\n\n");
      const doubleCRLFIndex = buffer.indexOf("\r\n\r\n");

      let delimiterIndex = doubleNewlineIndex;
      let delimiterLength = 2;

      if (doubleCRLFIndex !== -1) {
        if (delimiterIndex === -1 || doubleCRLFIndex < delimiterIndex) {
          delimiterIndex = doubleCRLFIndex;
          delimiterLength = 4;
        }
      }

      if (delimiterIndex === -1) {
        break;
      }

      const rawEvent = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + delimiterLength);
      const parsed = parseSseEvent(rawEvent);
      if (parsed) {
        events.push(parsed);
      }
    }
    return events;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = flushBuffer();
    for (const event of events) {
      if (event) {
        yield event;
        if (event.type === "end" || event.type === "error") {
          return;
        }
      }
    }
  }

  buffer += decoder.decode();
  const remaining = flushBuffer();
  for (const event of remaining) {
    if (event) {
      yield event;
      if (event.type === "end" || event.type === "error") {
        return;
      }
    }
  }
}
