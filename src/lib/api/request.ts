import { resolveApiBaseUrl } from "./baseUrl";
import { ApiError, ApiNetworkError } from "./errors";
import { buildBodyPreview } from "./utils";
import { getSupabaseAccessToken } from "../auth/supabaseAccessToken";

const stringifyErrorValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const extractErrorDetail = (detail: unknown): string | null => {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (entry && typeof entry === "object") {
          const record = entry as Record<string, unknown>;
          const msg =
            typeof record.msg === "string"
              ? record.msg
              : typeof record.message === "string"
                ? record.message
                : typeof record.error === "string"
                  ? record.error
                  : null;
          return msg ?? stringifyErrorValue(record);
        }
        return stringifyErrorValue(entry);
      })
      .filter((value): value is string => Boolean(value && value.trim()));
    if (messages.length) {
      return messages.join("; ");
    }
  }
  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : typeof record.detail === "string"
            ? record.detail
            : null;
    return message ?? stringifyErrorValue(record);
  }
  return stringifyErrorValue(detail);
};

const resolveApiErrorMessage = (errorData: unknown, status: number): string => {
  if (!errorData) {
    return `HTTP error! status: ${status}`;
  }
  if (typeof errorData === "string") {
    return errorData;
  }
  if (errorData instanceof Error) {
    return errorData.message;
  }
  if (Array.isArray(errorData)) {
    const arrayMessage = extractErrorDetail(errorData);
    if (arrayMessage) {
      return arrayMessage;
    }
    return stringifyErrorValue(errorData) ?? `HTTP error! status: ${status}`;
  }
  if (typeof errorData === "object") {
    const record = errorData as Record<string, unknown>;
    if (Object.keys(record).length === 0) {
      return `HTTP error! status: ${status}`;
    }
    const detailMessage = extractErrorDetail(record.detail);
    if (detailMessage) {
      return detailMessage;
    }
    const messageCandidate = extractErrorDetail(record.message ?? record.error);
    if (messageCandidate) {
      return messageCandidate;
    }
    return stringifyErrorValue(record) ?? `HTTP error! status: ${status}`;
  }
  return String(errorData);
};

export const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const startTime = performance.now();
  const baseUrl = resolveApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const shouldLogVerbose = process.env.NEXT_PUBLIC_ENABLE_API_LOGGING === "true";

  const logData = {
    requestId,
    endpoint,
    baseUrl,
    url,
    method: options.method ?? "GET",
    usesProxy: baseUrl.startsWith("/api/"),
    bodyPreview: buildBodyPreview(options.body),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server-side",
    timestamp: new Date().toISOString(),
  };

  if (shouldLogVerbose) {
    console.log(`[INFO][ApiService.fetch:start]`, {
      ...logData,
      eventType: "api_request_start",
      performance_start: startTime,
    });
  }

  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = new Headers(options.headers ?? undefined);
  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = await getSupabaseAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    let response = await fetch(url, config);

    if (response.status === 401) {
      const refreshedToken = await getSupabaseAccessToken({ forceRefresh: true });
      if (refreshedToken) {
        headers.set("Authorization", `Bearer ${refreshedToken}`);
        response = await fetch(url, config);
      } else if (headers.has("Authorization")) {
        headers.delete("Authorization");
        response = await fetch(url, config);
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        const isUserLookup =
          normalizedEndpoint.includes("/users/email/") || normalizedEndpoint.includes("/users/");
        const isBackgroundFetch =
          normalizedEndpoint.includes("/api/conversation/") ||
          normalizedEndpoint.includes("/proactivity/");

        if (typeof window !== "undefined" && !isUserLookup && !isBackgroundFetch) {
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }
        }
        throw new ApiError(401, "Unauthorized");
      }

      if (response.status === 403) {
        throw new ApiError(403, "Access forbidden");
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = resolveApiErrorMessage(errorData, response.status);
      const responseTime = performance.now() - startTime;
      const upstreamTimeoutStatuses = [520, 521, 522, 523, 524, 525, 526, 527, 598, 599];
      const isUpstreamTimeout = upstreamTimeoutStatuses.includes(response.status);

      if (shouldLogVerbose) {
        if (response.status === 404) {
          console.debug(`[INFO][ApiService.fetch:response-404]`, {
            requestId,
            endpoint,
            url,
            method: config.method ?? "GET",
            status: response.status,
            timestamp: new Date().toISOString(),
          });
        } else if (isUpstreamTimeout) {
          console.warn(`[WARN][ApiService.fetch:upstream-timeout]`, {
            requestId,
            endpoint,
            url,
            method: config.method ?? "GET",
            status: response.status,
            statusText: response.statusText,
            errorDetail: errorMessage,
            responseTimeMs: responseTime,
            timestamp: new Date().toISOString(),
            eventType: "api_upstream_timeout",
          });
        } else {
          console.error(`[ERROR][ApiService.fetch:response-error]`, {
            requestId,
            endpoint,
            url,
            method: config.method ?? "GET",
            status: response.status,
            statusText: response.statusText,
            errorDetail: errorMessage,
            responseTimeMs: responseTime,
            contentType: response.headers.get("content-type"),
            timestamp: new Date().toISOString(),
            eventType: "api_response_error",
          });
        }
      }

      if (isUpstreamTimeout) {
        throw new ApiNetworkError(`Upstream timeout (${response.status}) while calling ${endpoint}`);
      }

      throw new ApiError(response.status, errorMessage);
    }

    if (response.status === 204) {
      const responseTime = performance.now() - startTime;
      if (shouldLogVerbose) {
        console.log(`[INFO][ApiService.fetch:success]`, {
          requestId,
          endpoint,
          status: response.status,
          responseTimeMs: responseTime,
          contentType: "no-content",
          timestamp: new Date().toISOString(),
          eventType: "api_response_success_no_content",
        });
      }
      return undefined as T;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseTime = performance.now() - startTime;
      if (shouldLogVerbose) {
        console.log(`[INFO][ApiService.fetch:success]`, {
          requestId,
          endpoint,
          status: response.status,
          responseTimeMs: responseTime,
          contentType: contentType || "unknown",
          timestamp: new Date().toISOString(),
          eventType: "api_response_success_non_json",
        });
      }
      return undefined as T;
    }

    const responseData = await response.json();
    const responseTime = performance.now() - startTime;

    if (shouldLogVerbose) {
      console.log(`[INFO][ApiService.fetch:success]`, {
        requestId,
        endpoint,
        status: response.status,
        responseTimeMs: responseTime,
        contentType,
        responseDataSize: JSON.stringify(responseData).length,
        timestamp: new Date().toISOString(),
        eventType: "api_response_success_json",
      });
    }

    return responseData;
  } catch (error) {
    const errorTime = performance.now() - startTime;

    if (error instanceof ApiError && error.status === 404) {
      if (shouldLogVerbose) {
        console.debug(`[DEBUG][ApiService.fetch:404-error]`, {
          requestId,
          endpoint,
          url,
          method: config.method ?? "GET",
          responseTimeMs: errorTime,
          error: error.message,
          timestamp: new Date().toISOString(),
          eventType: "api_404_error",
        });
      }
      throw error;
    }

    if (error instanceof TypeError) {
      const normalizedMessage = error.message.toLowerCase();
      const isNetworkFailure =
        normalizedMessage.includes("failed to fetch") ||
        normalizedMessage.includes("fetch failed") ||
        normalizedMessage.includes("networkerror") ||
        normalizedMessage.includes("network request failed");

      if (isNetworkFailure) {
        const friendlyMessage = `Unable to reach the API at ${baseUrl}. Verify that the backend service is running and accessible.`;

        if (shouldLogVerbose) {
          console.warn(`[WARN][ApiService.fetch:network-error]`, {
            requestId,
            endpoint,
            url,
            method: config.method ?? "GET",
            responseTimeMs: errorTime,
            originalError: error.message,
            friendlyMessage,
            baseUrl,
            timestamp: new Date().toISOString(),
            eventType: "api_network_error",
          });
        }

        throw new ApiNetworkError(friendlyMessage);
      }
    }

    if (error instanceof ApiNetworkError) {
      if (shouldLogVerbose) {
        console.warn(`[WARN][ApiService.fetch:network-error-rethrow]`, {
          requestId,
          endpoint,
          url,
          method: config.method ?? "GET",
          responseTimeMs: errorTime,
          message: error.message,
          timestamp: new Date().toISOString(),
          eventType: "api_network_error_rethrow",
        });
      }
      throw error;
    }

    if (shouldLogVerbose) {
      const errorDetails =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error;

      console.error(`[ERROR][ApiService.fetch:unexpected-error]`, {
        requestId,
        endpoint,
        url,
        method: config.method ?? "GET",
        baseUrl,
        error: errorDetails,
        responseTimeMs: errorTime,
        timestamp: new Date().toISOString(),
        eventType: "api_unexpected_error",
      });

      console.error(`API Request Failed:`, {
        endpoint,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unexpected API error");
  }
};
