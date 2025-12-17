import { getSupabaseClient } from "../supabaseClient";
import { resolveApiBaseUrl } from "./baseUrl";
import { ApiError, ApiNetworkError } from "./errors";
import { buildBodyPreview } from "./utils";

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

  const supabase = getSupabaseClient();
  if (supabase) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.auth as any).getSession();
    const token = data.session?.access_token;
    if (typeof token === "string" && token.length > 20 && token.split(".").length === 3) {
      headers.set("Authorization", `Bearer ${token}`);
    } else if (token) {
      console.warn("[ApiService] Invalid auth token detected. Clearing session.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.auth as any).signOut().catch(() => {});
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        const isUserLookup = endpoint.includes("/users/email/") || endpoint.includes("/users/");
        const isBackgroundFetch =
          endpoint.includes("/api/conversation/") || endpoint.includes("/proactivity/");

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
            errorDetail: (errorData as { detail?: unknown })?.detail ?? null,
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
            errorDetail: (errorData as { detail?: unknown })?.detail ?? null,
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

      throw new ApiError(
        response.status,
        (errorData as { detail?: string }).detail || `HTTP error! status: ${response.status}`,
      );
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

