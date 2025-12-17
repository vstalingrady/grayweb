import { getSupabaseClient } from "../supabaseClient";
import { resolveApiBaseUrl } from "./baseUrl";
import { buildBodyPreview } from "./utils";
import type { ChatRequest, ChatStreamEvent, ChatStreamTiming } from "./types";

export async function* sendChatMessageStream(
  request: ChatRequest,
  options?: { signal?: AbortSignal },
): AsyncGenerator<ChatStreamEvent, void, unknown> {
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

  const headers: HeadersInit = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.auth as any).getSession();
    const token = data.session?.access_token;
    if (typeof token === "string" && token.length > 20 && token.split(".").length === 3) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (token) {
      console.warn("[ApiService.stream] Invalid auth token detected. Clearing session.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.auth as any).signOut().catch(() => {});
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal: options?.signal,
  });

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

  /* eslint-disable @typescript-eslint/no-explicit-any */
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
      const delta = (payload as any).delta ?? (payload as any).token ?? (payload as any).text ?? "";
      return delta ? { type: "token", delta } : null;
    }

    if (eventType === "end") {
      return {
        type: "end",
        conversationId: (payload as any).conversation_id ?? (payload as any).conversationId ?? null,
        response: (payload as any).response ?? (payload as any).text ?? "",
        title: (payload as any).title ?? null,
        groundingMetadata: (payload as any).grounding_metadata ?? (payload as any).groundingMetadata ?? null,
        timing: (() => {
          const rawTiming = (payload as any).timing;
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
        message: (payload as any).message ?? (payload as any).error ?? "Stream error",
      };
    }

    if (eventType === "reminders") {
      const reminders = (payload as any).reminders;
      if (Array.isArray(reminders)) {
        return {
          type: "reminders",
          reminders,
        };
      }
      return null;
    }

    if (eventType === "usage") {
      const usage = (payload as any).usage;
      if (usage) {
        return {
          type: "usage",
          usage,
        };
      }
      return null;
    }

    const fallbackDelta = (payload as any).delta ?? (payload as any).token ?? (payload as any).text;
    return fallbackDelta ? { type: "token", delta: fallbackDelta } : null;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

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

