import { getSupabaseClient } from './supabaseClient';

const DEV_FALLBACK_API_URL = 'http://localhost:8000';
const API_PROXY_PREFIX = '/api/backend';

const isProxyDisabled = () =>
  process.env.NEXT_PUBLIC_DISABLE_API_PROXY?.toLowerCase() === 'true';

const shouldUseProxyBase = (candidateUrl?: string) => {
  if (typeof window === 'undefined' || isProxyDisabled()) {
    return false;
  }

  const trimmed = candidateUrl?.trim();
  if (!trimmed || trimmed.length === 0) {
    return true;
  }

  if (trimmed.startsWith('/')) {
    return false;
  }

  const currentOrigin = window.location?.origin;
  if (currentOrigin) {
    try {
      const candidateOrigin = new URL(trimmed, currentOrigin).origin;
      if (candidateOrigin !== currentOrigin) {
        return true;
      }
    } catch {
      // Fall back to existing heuristics when the candidate URL is malformed.
    }
  }

  const usesInsecureHttp = trimmed.toLowerCase().startsWith('http://');
  const isSecureContext = window.location?.protocol === 'https:';

  return Boolean(isSecureContext && usesInsecureHttp);
};

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const isLocalLikeHostname = (hostname: string | null | undefined): boolean => {
  if (!hostname) {
    return false;
  }
  const normalized = hostname.toLowerCase();
  if (LOCALHOST_HOSTNAMES.has(normalized)) {
    return true;
  }
  return normalized.endsWith('.localhost');
};

const adaptEnvBaseUrlForClientHost = (value: string): string => {
  if (typeof window === 'undefined') {
    return value;
  }

  let parsed: URL | null = null;
  try {
    parsed = new URL(value, window.location.origin);
  } catch {
    return value;
  }

  const normalizedHost = parsed.hostname?.toLowerCase();
  const clientHost = window.location.hostname?.toLowerCase();
  if (normalizedHost && isLocalLikeHostname(normalizedHost) && clientHost && !isLocalLikeHostname(clientHost)) {
    parsed.hostname = clientHost;
    return stripTrailingSlashes(parsed.toString());
  }

  return value;
};

const enforceSecureBaseUrl = (value: string): string => {
  const trimmed = stripTrailingSlashes(value);
  if (!trimmed || trimmed.startsWith('/')) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const isInsecureHttp = lower.startsWith('http://');
  const isSecureContext = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  if (!isSecureContext || !isInsecureHttp) {
    return trimmed;
  }

  let hostname: string | null = null;
  try {
    hostname = new URL(trimmed).hostname;
  } catch {
    hostname = null;
  }

  if (hostname && isLocalLikeHostname(hostname)) {
    return trimmed;
  }

  if (!isProxyDisabled()) {
    return API_PROXY_PREFIX;
  }

  return stripTrailingSlashes(trimmed.replace(/^http:\/\//i, 'https://'));
};

export const resolveApiBaseUrl = () => {
  // Hardcoded override to prevent Mixed Content errors on the production domain.
  // This ensures we always use the relative proxy path instead of trying to hit port 8000 directly.
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'gray.alignment.id' || window.location.protocol === 'https:') {
      return API_PROXY_PREFIX;
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const adaptedUrl = adaptEnvBaseUrlForClientHost(envUrl);
    let adaptedHostname: string | null = null;
    try {
      adaptedHostname = new URL(adaptedUrl, typeof window !== 'undefined' ? window.location.origin : undefined).hostname;
    } catch {
      adaptedHostname = null;
    }
    const isSecureContext = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const usesInsecureHttp = adaptedUrl.toLowerCase().startsWith('http://');

    // Force HTTPS or proxy for non-local hosts even during SSR to avoid mixed-content requests.
    if (usesInsecureHttp && adaptedHostname && !isLocalLikeHostname(adaptedHostname)) {
      if (!isProxyDisabled()) {
        return API_PROXY_PREFIX;
      }
      return stripTrailingSlashes(adaptedUrl.replace(/^http:\/\//i, 'https://'));
    }

    // Avoid mixed-content fetches when the page is served over HTTPS.
    if (isSecureContext && usesInsecureHttp) {
      if (!isProxyDisabled()) {
        return API_PROXY_PREFIX;
      }
      return stripTrailingSlashes(adaptedUrl.replace(/^http:\/\//i, 'https://'));
    }

    if (shouldUseProxyBase(adaptedUrl)) {
      return API_PROXY_PREFIX;
    }
    return enforceSecureBaseUrl(adaptedUrl);
  }

  if (shouldUseProxyBase()) {
    return API_PROXY_PREFIX;
  }

  if (typeof window !== 'undefined' && window.location) {
    const { origin, hostname } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return enforceSecureBaseUrl(origin);
    }
  }

  const runtimeUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (runtimeUrl && runtimeUrl.trim().length > 0) {
    const normalized = runtimeUrl.startsWith('http') ? runtimeUrl : `https://${runtimeUrl}`;
    return enforceSecureBaseUrl(normalized);
  }

  return enforceSecureBaseUrl(DEV_FALLBACK_API_URL);
};

const isDevEnv = () => process.env.NODE_ENV !== 'production';

const buildBodyPreview = (body: unknown): string | undefined => {
  if (!body) {
    return undefined;
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return '[FormData body]';
  }
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  }
  try {
    const serialized = JSON.stringify(body);
    return serialized.length > 400 ? `${serialized.slice(0, 400)}…` : serialized;
  } catch {
    return '[Unserializable body]';
  }
};

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

export const isApiNetworkError = (value: unknown): value is ApiNetworkError =>
  value instanceof ApiNetworkError;
export { ApiError, ApiNetworkError };

export interface FileSearchUploadResponse {
  name: string;
  display_name?: string;
  uri?: string;
}

export interface UsageStatus {
  tier: string;
  monthly_usage: number;
  monthly_limit: number;
  is_monthly_limit_reached: boolean;
  next_monthly_reset: string;
  six_hour_usage: number;
  six_hour_limit: number;
  is_six_hour_limit_reached: boolean;
  next_six_hour_reset: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  profile_picture_url?: string;
  role: string;
  plan_tier?: string | null;
  initials: string;
  workspace_background_id?: string | null;
  maps_enabled: boolean;
  has_seen_general_chat?: boolean;
  personalization_nickname?: string | null;
  personalization_occupation?: string | null;
  personalization_about?: string | null;
  personalization_custom_instructions?: string | null;
  personalization_system_prompt_override?: string | null;
  personalization_show_calendar?: boolean;
  created_at: string;
  updated_at: string;
  usage_status?: UsageStatus | null;
}

export interface ChatSession {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: number;
  user_id: number;
  calendar_id?: number | null;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  color?: string;
  created_at: string;
}

export interface Calendar {
  id: number;
  user_id: number;
  label: string;
  color: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: number;
  user_id: number;
  label: string;
  completed: boolean;
  deadline?: string | null;
  schedule_slot?: string | null;
  description?: string | null;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: number;
  user_id: number;
  label: string;
  streak_label: string;
  previous_label: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardPulsePlanItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface DashboardPulseHabitItem {
  id: string;
  label: string;
  streak_label?: string | null;
  previous_label?: string | null;
  completed: boolean;
}

export interface DashboardPulseProactivity {
  id: string;
  label: string;
  description?: string | null;
  cadence: string;
  time: string;
}

export interface DashboardPulse {
  id: number;
  user_id: number;
  date_key: string;
  timestamp: number;
  plans: DashboardPulsePlanItem[];
  habits: DashboardPulseHabitItem[];
  proactivity: DashboardPulseProactivity;
  created_at: string;
  updated_at: string;
}

export type ReminderStatus =
  | "pending"
  | "delivered"
  | "completed"
  | "cancelled"
  | "failed";

export interface Reminder {
  id: number;
  user_id: number;
  label: string;
  description?: string | null;
  remind_at: string;
  entity_type?: string | null;
  entity_id?: number | null;
  delivery_mode?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  status: ReminderStatus;
  color?: string;
  created_at: string;
  updated_at: string;
  delivered_at?: string | null;
}

export interface ReminderCreatePayload {
  label: string;
  remind_at: string;
  description?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  delivery_mode?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  color?: string;
}

export interface ReminderUpdatePayload {
  label?: string;
  description?: string | null;
  remind_at?: string;
  status?: ReminderStatus;
  delivery_mode?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  color?: string;
}

export interface ProactivitySettings {
  id?: string | null;
  label?: string | null;
  description?: string | null;
  cadence?: string | null;
  time?: string | null;
  times?: string[] | null;
  channels?: string[] | null;
  timezone?: string | null;
}

export interface ProactivityNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  due_at?: string | null;
  sent_at: string;
  read_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface UserStreak {
  id: number;
  user_id: number;
  current_streak: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  user_id: number;
  service: string;
  api_key: string;
  created_at?: string;
}

export interface ApiKeyCreate {
  user_id: number;
  service: string;
  api_key: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  grounding_metadata?: GroundingMetadata | null;
  groundingMetadata?: GroundingMetadata | null;
}

export interface MediaUpload {
  id: number;
  user_id: number;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
  previewUrl?: string;
}

export interface ChatAttachmentRequest {
  id: number;
}

export interface ContextCacheBase {
  conversation_id?: string;
  label?: string;
  content: string;
}

export interface ContextCache extends ContextCacheBase {
  id: number;
  user_id: number;
  created_at: string;
}

export interface GroundingChunkMaps {
  uri?: string;
  title?: string;
  placeId?: string;
  googleMapsUri?: string;
}

export interface GroundingChunkWeb {
  uri?: string;
  title?: string;
  site?: string;
  domain?: string;
}

export interface GroundingChunkRetrievedContext {
  uri?: string;
  title?: string;
  text?: string;
  document_name?: string;
}

export interface GroundingChunk {
  maps?: GroundingChunkMaps;
  web?: GroundingChunkWeb;
  retrieved_context?: GroundingChunkRetrievedContext;
}

export interface GroundingSupport {
  grounding_chunk_indices?: number[];
  confidence_scores?: number[];
}

export interface GroundingSearchEntryPoint {
  rendered_content?: string;
  sdk_blob?: string;
}

export interface GroundingMetadata {
  grounding_chunks?: GroundingChunk[];
  grounding_supports?: GroundingSupport[];
  google_maps_widget_context_token?: string;
  web_search_queries?: string[];
  search_entry_point?: GroundingSearchEntryPoint;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  user_id: number;
  system_prompt?: string;
  context?: string;
  time_context?: string;
  timezone?: string;
  model?: string;
  attachments?: ChatAttachmentRequest[];
  responseJsonSchema?: Record<string, unknown>;
  responseMimeType?: string;
  context_cache_id?: number;
  maps_enabled?: boolean;
  maps_latitude?: number;
  maps_longitude?: number;
  maps_widget?: boolean;
  web_search_enabled?: boolean;
  file_search_enabled?: boolean;
  should_generate_title?: boolean;
  reasoning_mode?: boolean;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  groundingMetadata?: GroundingMetadata;
  title?: string | null;
  message_id?: number;
}

export interface ChatStarterRequest {
  user_id: number;
  name?: string | null;
  nickname?: string | null;
  occupation?: string | null;
  about?: string | null;
  custom_instructions?: string | null;
  workspace_context?: string | null;
  system_prompt?: string | null;
  time_context?: string | null;
}

export interface ChatStarterResponse {
  message: string;
  used_fallback?: boolean;
}

export interface ConversationSummary {
  id: string;
  title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationUpdatePayload {
  title?: string;
  user_id?: number;
}

export interface ConversationUsage {
  conversationId: string;
  messageCount: number;
  conversationTokens: number;
  /**
   * Maximum tokens available for this conversation.
   *  - > 0: finite context window, derived from backend-provided limits or explicit overrides.
   *  - 0 or negative: treated as "unlimited" / "no cap" by the UI.
   */
  limit: number;
  provider: string;
  modelName?: string | null;
  modelLabel?: string | null;
}

export interface WorkspaceBackground {
  id: number;
  slug: string;
  label: string;
  description?: string | null;
  preview_css: string;
  backdrop_css: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceBackgroundCreate {
  slug?: string;
  label: string;
  description?: string | null;
  preview_css: string;
  backdrop_css: string;
}

export interface WorkspaceBackgroundAssetUploadResponse {
  filename: string;
  asset_path: string;
  content_type: string;
  size: number;
}

export type ChatStreamTokenEvent = {
  type: 'token';
  delta: string;
};

export type ChatStreamTiming = {
  totalMs: number;
  firstTokenMs?: number;
};

export type ChatStreamEndEvent = {
  type: 'end';
  conversationId: string | null;
  response: string;
  title?: string | null;
  groundingMetadata?: GroundingMetadata | null;
  timing?: ChatStreamTiming;
};

export type ChatStreamErrorEvent = {
  type: 'error';
  message: string;
};

export type ChatStreamRemindersEvent = {
  type: 'reminders';
  reminders: unknown[];
};

export type ChatStreamEvent = ChatStreamTokenEvent | ChatStreamEndEvent | ChatStreamErrorEvent | ChatStreamRemindersEvent;

type StreamPayload = {
  delta?: string;
  token?: string;
  text?: string;
  conversation_id?: string;
  conversationId?: string;
  response?: string;
  title?: string | null;
  grounding_metadata?: GroundingMetadata | null;
  groundingMetadata?: GroundingMetadata | null;
  message?: string;
  error?: string;
  timing?: {
    total_ms?: number;
    first_token_ms?: number;
    totalMs?: number;
    firstTokenMs?: number;
  };
};

export interface GoogleAuthResponse {
  authorization_url: string;
  state?: string;
}

export interface UserCreate {
  email: string;
  full_name: string;
  profile_picture_url?: string;
  role?: string;
  personalization_nickname?: string | null;
  personalization_occupation?: string | null;
  personalization_about?: string | null;
  personalization_custom_instructions?: string | null;
}

export interface UserUpdate {
  full_name?: string;
  profile_picture_url?: string;
  role?: string;
  plan_tier?: string | null;
  workspace_background_id?: string | null;
  maps_enabled?: boolean;
  has_seen_general_chat?: boolean;
  personalization_nickname?: string | null;
  personalization_occupation?: string | null;
  personalization_about?: string | null;
  personalization_custom_instructions?: string | null;
  personalization_show_calendar?: boolean;
}

class ApiService {
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const startTime = performance.now();
    const baseUrl = resolveApiBaseUrl();
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${normalizedEndpoint}`;

    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    // Enhanced logging configuration
    // - Always log errors in development.
    // - Only log verbose per-request start/success details when the explicit flag is enabled.
    const logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    const shouldLogVerbose = process.env.NEXT_PUBLIC_ENABLE_API_LOGGING === 'true';
    const shouldLogErrors = isDevEnv() || shouldLogVerbose;

    const logData = {
      requestId,
      endpoint,
      baseUrl,
      url,
      method: options.method ?? 'GET',
      usesProxy: baseUrl.startsWith('/api/'),
      bodyPreview: buildBodyPreview(options.body),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server-side',
      timestamp: new Date().toISOString(),
    };

    if (shouldLogVerbose) {
      console.log(`[${logLevel.toUpperCase()}][ApiService.fetch:start]`, {
        ...logData,
        eventType: 'api_request_start',
        performance_start: startTime,
      });
    }

    const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = new Headers(options.headers ?? undefined);
    if (!isFormDataBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Inject Supabase Auth Token
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      // Ensure token is a valid JWT string (simple heuristic: non-empty, has 3 parts)
      if (typeof token === 'string' && token.length > 20 && token.split('.').length === 3) {
        headers.set('Authorization', `Bearer ${token}`);
      } else if (token) {
        console.warn('[ApiService] Invalid auth token detected. Clearing session.');
        await supabase.auth.signOut().catch(() => { });
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        // Handle Authentication Errors
        if (response.status === 401) {
          // Don't auto-redirect for user lookup endpoints - user might not exist yet
          const isUserLookup = endpoint.includes('/users/email/') || endpoint.includes('/users/');
          // Also avoid redirecting for background data fetches that might race with auth
          const isBackgroundFetch = endpoint.includes('/api/conversation/') || endpoint.includes('/proactivity/');

          if (typeof window !== 'undefined' && !isUserLookup && !isBackgroundFetch) {
            // Only redirect if we're not already on the login page to avoid loops
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
          throw new ApiError(401, 'Unauthorized');
        }

        if (response.status === 403) {
          throw new ApiError(403, 'Access forbidden');
        }

        const errorData = await response.json().catch(() => ({}));
        const responseTime = performance.now() - startTime;
        const upstreamTimeoutStatuses = [520, 521, 522, 523, 524, 525, 526, 527, 598, 599];
        const isUpstreamTimeout = upstreamTimeoutStatuses.includes(response.status);

        if (shouldLogErrors) {
          // Don't log 404s as errors, as they are often used for control flow (e.g. checking if user exists)
          if (response.status === 404) {
            console.debug(`[INFO][ApiService.fetch:response-404]`, {
              requestId,
              endpoint,
              url,
              method: config.method ?? 'GET',
              status: response.status,
              timestamp: new Date().toISOString(),
            });
          } else if (isUpstreamTimeout) {
            const logMethod = isDevEnv() ? console.warn : console.error;
            logMethod(`[WARN][ApiService.fetch:upstream-timeout]`, {
              requestId,
              endpoint,
              url,
              method: config.method ?? 'GET',
              status: response.status,
              statusText: response.statusText,
              errorDetail: (errorData as { detail?: unknown })?.detail ?? null,
              responseTimeMs: responseTime,
              timestamp: new Date().toISOString(),
              eventType: 'api_upstream_timeout',
            });
          } else {
            console.error(`[ERROR][ApiService.fetch:response-error]`, {
              requestId,
              endpoint,
              url,
              method: config.method ?? 'GET',
              status: response.status,
              statusText: response.statusText,
              errorDetail: (errorData as { detail?: unknown })?.detail ?? null,
              responseTimeMs: responseTime,
              contentType: response.headers.get('content-type'),
              timestamp: new Date().toISOString(),
              eventType: 'api_response_error',
            });
          }
        }

        if (isUpstreamTimeout) {
          throw new ApiNetworkError(
            `Upstream timeout (${response.status}) while calling ${endpoint}`
          );
        }

        throw new ApiError(
          response.status,
          errorData.detail || `HTTP error! status: ${response.status}`
        );
      }

      if (response.status === 204) {
        const responseTime = performance.now() - startTime;
        if (shouldLogVerbose) {
          console.log(`[${logLevel.toUpperCase()}][ApiService.fetch:success]`, {
            requestId,
            endpoint,
            status: response.status,
            responseTimeMs: responseTime,
            contentType: 'no-content',
            timestamp: new Date().toISOString(),
            eventType: 'api_response_success_no_content',
          });
        }
        return undefined as T;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseTime = performance.now() - startTime;
        if (shouldLogVerbose) {
          console.log(`[${logLevel.toUpperCase()}][ApiService.fetch:success]`, {
            requestId,
            endpoint,
            status: response.status,
            responseTimeMs: responseTime,
            contentType: contentType || 'unknown',
            timestamp: new Date().toISOString(),
            eventType: 'api_response_success_non_json',
          });
        }
        return undefined as T;
      }

      const responseData = await response.json();
      const responseTime = performance.now() - startTime;

      if (shouldLogVerbose) {
        console.log(`[${logLevel.toUpperCase()}][ApiService.fetch:success]`, {
          requestId,
          endpoint,
          status: response.status,
          responseTimeMs: responseTime,
          contentType,
          responseDataSize: JSON.stringify(responseData).length,
          timestamp: new Date().toISOString(),
          eventType: 'api_response_success_json',
        });
      }

      return responseData;
    } catch (error) {
      const errorTime = performance.now() - startTime;
      const baseUrl = resolveApiBaseUrl();

      if (error instanceof ApiError && error.status === 404) {
        if (shouldLogErrors) {
          console.debug(`[DEBUG][ApiService.fetch:404-error]`, {
            requestId,
            endpoint,
            url,
            method: config.method ?? 'GET',
            responseTimeMs: errorTime,
            error: error.message,
            timestamp: new Date().toISOString(),
            eventType: 'api_404_error',
          });
        }
        throw error;
      }

      if (error instanceof TypeError) {
        const normalizedMessage = error.message.toLowerCase();
        const isNetworkFailure =
          normalizedMessage.includes('failed to fetch') ||
          normalizedMessage.includes('fetch failed') ||
          normalizedMessage.includes('networkerror') ||
          normalizedMessage.includes('network request failed');

        if (isNetworkFailure) {
          const friendlyMessage = `Unable to reach the API at ${baseUrl}. Verify that the backend service is running and accessible.`;

          if (shouldLogErrors) {
            const logMethod = isDevEnv() ? console.warn : console.error;
            logMethod(`[WARN][ApiService.fetch:network-error]`, {
              requestId,
              endpoint,
              url,
              method: config.method ?? 'GET',
              responseTimeMs: errorTime,
              originalError: error.message,
              friendlyMessage,
              baseUrl,
              timestamp: new Date().toISOString(),
              eventType: 'api_network_error',
            });
          }

          throw new ApiNetworkError(friendlyMessage);
        }
      }

      if (error instanceof ApiNetworkError) {
        if (shouldLogErrors) {
          const logMethod = isDevEnv() ? console.warn : console.error;
          logMethod(`[WARN][ApiService.fetch:network-error-rethrow]`, {
            requestId,
            endpoint,
            url,
            method: config.method ?? 'GET',
            responseTimeMs: errorTime,
            message: error.message,
            timestamp: new Date().toISOString(),
            eventType: 'api_network_error_rethrow',
          });
        }
        throw error;
      }

      // Unexpected error logging
      if (shouldLogErrors) {
        const errorDetails = error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error;

        console.error(`[ERROR][ApiService.fetch:unexpected-error]`, {
          requestId,
          endpoint,
          url,
          method: config.method ?? 'GET',
          baseUrl,
          error: errorDetails,
          responseTimeMs: errorTime,
          timestamp: new Date().toISOString(),
          eventType: 'api_unexpected_error',
        });

        // Also log to console in a more readable format
        console.error(`API Request Failed:`, {
          endpoint,
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Unexpected API error');
    }
  }

  // User endpoints
  async createUser(userData: UserCreate): Promise<User> {
    return this.fetch<User>('/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getUser(userId: number): Promise<User> {
    return this.fetch<User>(`/users/${userId}`);
  }

  async getUserByEmail(email: string): Promise<User> {
    return this.fetch<User>(`/users/email/${encodeURIComponent(email)}`);
  }

  async updateUser(userId: number, userData: UserUpdate): Promise<User> {
    return this.fetch<User>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: number): Promise<void> {
    await this.fetch<void>(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async storeUserApiKey(userId: number, payload: ApiKeyCreate): Promise<ApiKey> {
    return this.fetch<ApiKey>(`/users/${userId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getUserApiKey(userId: number, service: string): Promise<ApiKey | null> {
    try {
      return await this.fetch<ApiKey>(`/users/${userId}/api-keys/${service}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // Chat sessions
  async getUserChatSessions(userId: number): Promise<ChatSession[]> {
    return this.fetch<ChatSession[]>(`/users/${userId}/chat-sessions`);
  }

  async createChatSession(userId: number, sessionData: { title: string }): Promise<ChatSession> {
    return this.fetch<ChatSession>(`/users/${userId}/chat-sessions`, {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  // Dashboard pulses
  async getDashboardPulses(userId: number, limit = 30): Promise<DashboardPulse[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    return this.fetch<DashboardPulse[]>(`/users/${userId}/dashboard/pulses?${params.toString()}`);
  }

  async createOrUpdateDashboardPulse(
    userId: number,
    payload: {
      date_key: string;
      timestamp: number;
      plans: DashboardPulsePlanItem[];
      habits: DashboardPulseHabitItem[];
      proactivity: DashboardPulseProactivity;
      carry_forward?: boolean;
    }
  ): Promise<DashboardPulse> {
    return this.fetch<DashboardPulse>(`/users/${userId}/dashboard/pulses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Calendar events
  async getUserCalendarEvents(userId: number, options?: { startDate?: string; endDate?: string }): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (options?.startDate) {
      params.set("start_date", options.startDate);
    }
    if (options?.endDate) {
      params.set("end_date", options.endDate);
    }
    const suffix = params.toString();
    const endpoint = suffix ? `/users/${userId}/calendar-events?${suffix}` : `/users/${userId}/calendar-events`;
    return this.fetch<CalendarEvent[]>(endpoint);
  }

  async createCalendarEvent(userId: number, eventData: {
    calendar_id?: number | null;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    color?: string;
  }): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(`/users/${userId}/calendar-events`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async updateCalendarEvent(userId: number, eventId: number, eventData: {
    calendar_id?: number | null;
    title?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    color?: string;
  }): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(`/users/${userId}/calendar-events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(eventData),
    });
  }

  async deleteCalendarEvent(userId: number, eventId: number): Promise<void> {
    return this.fetch<void>(`/users/${userId}/calendar-events/${eventId}`, {
      method: 'DELETE',
    });
  }

  async getUserCalendars(userId: number): Promise<Calendar[]> {
    return this.fetch<Calendar[]>(`/users/${userId}/calendars`);
  }

  async updateCalendar(userId: number, calendarId: number, updateData: Partial<Pick<Calendar, 'label' | 'color' | 'is_visible'>>): Promise<Calendar> {
    return this.fetch<Calendar>(`/users/${userId}/calendars/${calendarId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  // Plans
  async getUserPlans(userId: number, limit?: number): Promise<Plan[]> {
    const endpoint = limit ? `/users/${userId}/plans?limit=${limit}` : `/users/${userId}/plans`;
    return this.fetch<Plan[]>(endpoint);
  }

  async updatePlan(
    userId: number,
    planId: number,
    updateData: {
      label?: string;
      completed?: boolean;
      deadline?: string | null;
      scheduleSlot?: string | null;
      description?: string | null;
    }
  ): Promise<Plan> {
    const payload: Record<string, unknown> = {};
    if (typeof updateData.label === "string") {
      payload.label = updateData.label;
    }
    if (typeof updateData.completed === "boolean") {
      payload.completed = updateData.completed;
    }
    if ("deadline" in updateData) {
      payload.deadline = updateData.deadline ?? null;
    }
    if ("scheduleSlot" in updateData) {
      payload.schedule_slot = updateData.scheduleSlot ?? null;
    }
    if ("description" in updateData) {
      payload.description = updateData.description ?? null;
    }

    return this.fetch<Plan>(`/users/${userId}/plans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deletePlan(userId: number, planId: number): Promise<void> {
    await this.fetch<void>(`/users/${userId}/plans/${planId}`, {
      method: 'DELETE',
    });
  }

  async createPlan(
    userId: number,
    planData: {
      label: string;
      completed?: boolean;
      deadline?: string | null;
      scheduleSlot?: string | null;
      description?: string | null;
    }
  ): Promise<Plan> {
    const payload = {
      label: planData.label,
      completed: planData.completed ?? false,
      deadline: planData.deadline ?? null,
      schedule_slot: planData.scheduleSlot ?? null,
      description: planData.description ?? null,
    };

    return this.fetch<Plan>(`/users/${userId}/plans`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Habits
  async getUserHabits(userId: number): Promise<Habit[]> {
    return this.fetch<Habit[]>(`/users/${userId}/habits`);
  }

  async createHabit(
    userId: number,
    habitData: {
      label: string;
      streak_label?: string | null;
      previous_label?: string | null;
      description?: string | null;
    }
  ): Promise<Habit> {
    const payload = {
      label: habitData.label,
      streak_label: habitData.streak_label ?? "0",
      previous_label: habitData.previous_label ?? "No history yet",
      description: habitData.description ?? null,
    };

    return this.fetch<Habit>(`/users/${userId}/habits`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateHabit(
    userId: number,
    habitId: number,
    updateData: {
      label?: string;
      streak_label?: string | null;
      previous_label?: string | null;
      description?: string | null;
    }
  ): Promise<Habit> {
    const payload: Record<string, unknown> = {};
    if (typeof updateData.label === "string") {
      payload.label = updateData.label;
    }
    if ("streak_label" in updateData) {
      payload.streak_label = updateData.streak_label ?? null;
    }
    if ("previous_label" in updateData) {
      payload.previous_label = updateData.previous_label ?? null;
    }
    if ("description" in updateData) {
      payload.description = updateData.description ?? null;
    }

    return this.fetch<Habit>(`/users/${userId}/habits/${habitId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteHabit(userId: number, habitId: number): Promise<void> {
    await this.fetch<void>(`/users/${userId}/habits/${habitId}`, {
      method: 'DELETE',
    });
  }

  // Reminders
  async getUserReminders(
    userId: number,
    options: {
      status?: ReminderStatus | string;
      limit?: number;
      deliveryMode?: string;
      entityType?: string;
      includeArchived?: boolean;
    } = {},
  ): Promise<Reminder[]> {
    const params = new URLSearchParams();
    if (options.status) {
      params.set('status_filter', options.status);
    }
    if (typeof options.limit === 'number') {
      params.set('limit', String(options.limit));
    }
    if (options.deliveryMode) {
      params.set('delivery_mode', options.deliveryMode);
    }
    if (options.entityType) {
      params.set('entity_type', options.entityType);
    }
    if (options.includeArchived) {
      params.set('include_archived', 'true');
    }
    const suffix = params.toString();
    const endpoint = suffix ? `/users/${userId}/reminders?${suffix}` : `/users/${userId}/reminders`;
    return this.fetch<Reminder[]>(endpoint);
  }

  async createReminder(userId: number, payload: ReminderCreatePayload): Promise<Reminder> {
    return this.fetch<Reminder>(`/users/${userId}/reminders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateReminder(
    userId: number,
    reminderId: number,
    payload: ReminderUpdatePayload,
  ): Promise<Reminder> {
    return this.fetch<Reminder>(`/users/${userId}/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteReminder(userId: number, reminderId: number): Promise<void> {
    await this.fetch<void>(`/users/${userId}/reminders/${reminderId}`, {
      method: 'DELETE',
    });
  }

  async getProactivitySettings(userId: number): Promise<ProactivitySettings | null> {
    return this.fetch<ProactivitySettings | null>(`/users/${userId}/proactivity/settings`);
  }

  async updateProactivitySettings(
    userId: number,
    settings: ProactivitySettings
  ): Promise<ProactivitySettings> {
    return this.fetch<ProactivitySettings>(`/users/${userId}/proactivity/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getProactivityNotifications(
    userId: number,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<ProactivityNotification[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.unreadOnly) {
      params.set('unread_only', 'true');
    }
    const suffix = params.toString();
    const endpoint = suffix
      ? `/users/${userId}/proactivity/notifications?${suffix}`
      : `/users/${userId}/proactivity/notifications`;
    return this.fetch<ProactivityNotification[]>(endpoint);
  }

  async markProactivityNotificationRead(
    userId: number,
    notificationId: number
  ): Promise<ProactivityNotification> {
    return this.fetch<ProactivityNotification>(
      `/users/${userId}/proactivity/notifications/${notificationId}/read`,
      {
        method: 'POST',
      }
    );
  }

  async uploadMediaFile(file: File): Promise<MediaUpload> {
    const form = new FormData();
    form.append('file', file);
    return this.fetch<MediaUpload>('/api/uploads', {
      method: 'POST',
      body: form,
    });
  }

  async createContextCache(userId: number, payload: ContextCacheBase): Promise<ContextCache> {
    const params = new URLSearchParams({ user_id: String(userId) });
    return this.fetch<ContextCache>(`/context-cache?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async getContextCache(cacheId: number): Promise<ContextCache> {
    return this.fetch<ContextCache>(`/context-cache/${cacheId}`);
  }

  async createFileSearchStore(displayName?: string): Promise<{ name: string; display_name?: string }> {
    return this.fetch<{ name: string; display_name?: string }>('/api/file-search/stores', {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName }),
    });
  }

  async uploadToFileSearchStore(options: {
    storeName: string;
    file: File;
    displayName?: string;
    chunkingConfig?: Record<string, unknown>;
  }): Promise<FileSearchUploadResponse> {
    const form = new FormData();
    form.append('store_name', options.storeName);
    form.append('file', options.file);
    if (options.displayName) {
      form.append('display_name', options.displayName);
    }
    if (options.chunkingConfig) {
      form.append('chunking_config', JSON.stringify(options.chunkingConfig));
    }
    return this.fetch<FileSearchUploadResponse>('/api/file-search/upload', {
      method: 'POST',
      body: form,
    });
  }

  async importFileSearch(payload: {
    storeName: string;
    fileName: string;
    chunkingConfig?: Record<string, unknown>;
  }): Promise<FileSearchUploadResponse> {
    return this.fetch<FileSearchUploadResponse>('/api/file-search/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_search_store_name: payload.storeName,
        file_name: payload.fileName,
        chunking_config: payload.chunkingConfig ?? undefined,
      }),
    });
  }

  async getUserStreak(userId: number): Promise<UserStreak> {
    return this.fetch<UserStreak>(`/users/${userId}/streak`);
  }

  async touchUserStreak(userId: number): Promise<UserStreak> {
    return this.fetch<UserStreak>(`/users/${userId}/streak`, {
      method: 'POST',
    });
  }

  async requestGoogleCalendarAuth(userId: number, options?: { redirectUri?: string }): Promise<GoogleAuthResponse> {
    const payload: Record<string, unknown> = { user_id: userId };
    if (options?.redirectUri) {
      payload.redirect_uri = options.redirectUri;
    }

    return this.fetch<GoogleAuthResponse>(`/users/${userId}/google-calendar/auth`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async triggerProactivityForUser(userId: number): Promise<void> {
    return this.fetch<void>(`/users/${userId}/proactivity/evaluate`, {
      method: 'POST',
    });
  }

  // AI Chat endpoints
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.fetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async requestChatStarter(payload: ChatStarterRequest): Promise<ChatStarterResponse> {
    return this.fetch<ChatStarterResponse>('/api/chat/starter', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async *sendMessageStream(
    request: ChatRequest,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const baseUrl = resolveApiBaseUrl();
    const endpoint = '/api/chat/stream';
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${normalizedEndpoint}`;
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    if (isDevEnv()) {
      // eslint-disable-next-line no-console
      console.debug('[ApiService.sendMessageStream:start]', {
        requestId,
        endpoint,
        baseUrl,
        url,
        usesProxy: baseUrl.startsWith('/api/'),
        bodyPreview: buildBodyPreview(request),
      });
    }

    const headers: HeadersInit = {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    };

    // Inject Supabase Auth Token
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      // Ensure token is a valid JWT string (simple heuristic: non-empty, has 3 parts)
      if (typeof token === 'string' && token.length > 20 && token.split('.').length === 3) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (token) {
        console.warn('[ApiService.stream] Invalid auth token detected. Clearing session.');
        await supabase.auth.signOut().catch(() => { });
      }
    }

    console.log('[ApiService.sendMessageStream] About to fetch:', {
      url,
      hasAuthHeader: !!headers['Authorization'],
      bodyKeys: Object.keys(request),
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: options?.signal,
      });
      console.log('[ApiService.sendMessageStream] Fetch completed:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });
    } catch (fetchError) {
      console.error('[ApiService.sendMessageStream] Fetch FAILED:', fetchError);
      throw fetchError;
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
      if (isDevEnv()) {
        // eslint-disable-next-line no-console
        console.error('[ApiService.sendMessageStream:response-error]', {
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

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      yield {
        type: 'end',
        conversationId: payload?.conversation_id ?? payload?.conversationId ?? null,
        response: payload?.response ?? payload?.text ?? '',
        title: payload?.title ?? null,
        groundingMetadata:
          payload?.grounding_metadata ?? payload?.groundingMetadata ?? null,
      };
      return;
    }

    if (!response.body) {
      throw new Error('Streaming response body is empty.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const parseSseEvent = (chunk: string): ChatStreamEvent | null => {
      // Pre-compile regex for better performance
      const newlineRegex = /\r?\n/;
      const lines = chunk.split(newlineRegex);
      let eventType = 'message';
      const dataLines: string[] = [];
      const dataPrefixLength = 'data:'.length;
      const eventPrefixLength = 'event:'.length;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line[0] === ':') {
          continue;
        }
        if (line.startsWith('event:')) {
          eventType = line.slice(eventPrefixLength).trim() || eventType;
        } else if (line.startsWith('data:')) {
          // Preserve the entire payload after the first "data:" prefix.
          let value = line.slice(dataPrefixLength);
          if (value.startsWith(' ')) {
            value = value.slice(1);
          }
          dataLines.push(value);
        }
      }

      const dataString = dataLines.join('\n');
      if (!dataString) {
        return null;
      }

      let payload: StreamPayload;
      try {
        payload = JSON.parse(dataString);
      } catch {
        payload = { delta: dataString };
      }

      // Early returns for better performance
      if (eventType === 'token') {
        const delta = (payload as any).delta ?? (payload as any).token ?? (payload as any).text ?? '';
        return delta ? { type: 'token', delta } : null;
      }

      if (eventType === 'end') {
        return {
          type: 'end',
          conversationId: (payload as any).conversation_id ?? (payload as any).conversationId ?? null,
          response: (payload as any).response ?? (payload as any).text ?? '',
          title: (payload as any).title ?? null,
          groundingMetadata:
            (payload as any).grounding_metadata ?? (payload as any).groundingMetadata ?? null,
          timing: (() => {
            const rawTiming = (payload as any).timing;
            if (!rawTiming) {
              return undefined;
            }
            const totalMs =
              typeof rawTiming.total_ms === 'number'
                ? rawTiming.total_ms
                : typeof rawTiming.totalMs === 'number'
                  ? rawTiming.totalMs
                  : undefined;
            if (typeof totalMs !== 'number' || !Number.isFinite(totalMs)) {
              return undefined;
            }
            const firstTokenMs =
              typeof rawTiming.first_token_ms === 'number'
                ? rawTiming.first_token_ms
                : typeof rawTiming.firstTokenMs === 'number'
                  ? rawTiming.firstTokenMs
                  : undefined;
            const timing: ChatStreamTiming = { totalMs };
            if (typeof firstTokenMs === 'number' && Number.isFinite(firstTokenMs)) {
              timing.firstTokenMs = firstTokenMs;
            }
            return timing;
          })(),
        };
      }

      if (eventType === 'error') {
        return {
          type: 'error',
          message: (payload as any).message ?? (payload as any).error ?? 'Stream error',
        };
      }

      if (eventType === 'reminders') {
        const reminders = (payload as any).reminders;
        if (Array.isArray(reminders)) {
          return {
            type: 'reminders',
            reminders,
          };
        }
        return null;
      }

      const fallbackDelta = (payload as any).delta ?? (payload as any).token ?? (payload as any).text;
      return fallbackDelta ? { type: 'token', delta: fallbackDelta } : null;
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const flushBuffer = (): ChatStreamEvent[] => {
      const events: ChatStreamEvent[] = [];
      while (true) {
        // Optimized: check both delimiters in a single pass
        const doubleNewlineIndex = buffer.indexOf('\n\n');
        const doubleCRLFIndex = buffer.indexOf('\r\n\r\n');

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
          if (event.type === 'end' || event.type === 'error') {
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
        if (event.type === 'end' || event.type === 'error') {
          return;
        }
      }
    }
  }

  async listUserConversations(userId: number, limit = 100): Promise<ConversationSummary[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    return this.fetch<ConversationSummary[]>(`/users/${userId}/conversations?${params.toString()}`);
  }

  /**
   * Permanently delete a conversation and its messages on the backend.
   * Used when a user deletes a chat so it is removed from both local state
   * and server-side context.
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.fetch<void>(`/api/conversation/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
    });
  }

  async overwriteConversationHistory(
    conversationId: string,
    messages: { role: 'user' | 'model'; text: string }[]
  ): Promise<void> {
    await this.fetch<void>(`/api/conversation/${encodeURIComponent(conversationId)}/history`, {
      method: 'PUT',
      body: JSON.stringify({ messages }),
    });
  }

  async saveMessage(conversationId: string, role: 'user' | 'model', text: string, userId?: number): Promise<void> {
    await this.fetch(`/api/conversation/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, text, user_id: userId }),
    });
  }

  async updateConversation(conversationId: string, payload: ConversationUpdatePayload): Promise<ConversationSummary> {
    return this.fetch<ConversationSummary>(`/api/conversation/${encodeURIComponent(conversationId)}/metadata`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getConversation(conversationId: string): Promise<ChatMessage[]> {
    return this.fetch<ChatMessage[]>(`/api/conversation/${conversationId}`);
  }

  async getConversationUsage(conversationId: string): Promise<ConversationUsage | null> {
    try {
      const payload = await this.fetch<{
        conversation_id: string;
        message_count: number;
        conversation_tokens: number;
        limit: number;
        provider: string;
        model_name?: string | null;
        model_label?: string | null;
      }>(`/api/conversation/${conversationId}/usage`);

      const normalizedLimit =
        typeof payload.limit === "number" && Number.isFinite(payload.limit)
          ? payload.limit
          : 0;

      return {
        conversationId: payload.conversation_id,
        messageCount: payload.message_count,
        conversationTokens: payload.conversation_tokens,
        limit: normalizedLimit,
        provider: payload.provider ?? "local",
        modelName: payload.model_name ?? null,
        modelLabel: payload.model_label ?? null,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async compressConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
    return this.fetch<{ success: boolean; message: string }>(`/api/conversation/${encodeURIComponent(conversationId)}/compress`, {
      method: 'POST',
    });
  }

  async createConversation(title: string, userId: number): Promise<{ id: string; title: string; history: ChatMessage[] }> {
    return this.fetch('/api/conversation', {
      method: 'POST',
      body: JSON.stringify({ title, user_id: userId }),
    });
  }

  async listWorkspaceBackgrounds(): Promise<WorkspaceBackground[]> {
    return this.fetch<WorkspaceBackground[]>('/api/workspace-backgrounds');
  }

  async createWorkspaceBackground(payload: WorkspaceBackgroundCreate): Promise<WorkspaceBackground> {
    return this.fetch<WorkspaceBackground>('/api/workspace-backgrounds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async uploadWorkspaceBackgroundAsset(file: File): Promise<WorkspaceBackgroundAssetUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.fetch<WorkspaceBackgroundAssetUploadResponse>('/api/workspace-backgrounds/assets', {
      method: 'POST',
      body: formData,
    });
  }
}

export const apiService = new ApiService();
