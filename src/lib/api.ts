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

  const usesInsecureHttp = trimmed.toLowerCase().startsWith('http://');
  const isSecureContext = window.location?.protocol === 'https:';

  return Boolean(isSecureContext && usesInsecureHttp);
};

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const resolveApiBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    if (shouldUseProxyBase(envUrl)) {
      return API_PROXY_PREFIX;
    }
    return stripTrailingSlashes(envUrl);
  }

  if (shouldUseProxyBase()) {
    return API_PROXY_PREFIX;
  }

  if (typeof window !== 'undefined' && window.location) {
    const { origin, hostname } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return stripTrailingSlashes(origin);
    }
  }

  const runtimeUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (runtimeUrl && runtimeUrl.trim().length > 0) {
    const normalized = runtimeUrl.startsWith('http') ? runtimeUrl : `https://${runtimeUrl}`;
    return stripTrailingSlashes(normalized);
  }

  return stripTrailingSlashes(DEV_FALLBACK_API_URL);
};

export interface User {
  id: number;
  email: string;
  full_name: string;
  profile_picture_url?: string;
  role: string;
  initials: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: number;
  user_id: number;
  label: string;
  streak_label: string;
  previous_label: string;
  created_at: string;
  updated_at: string;
}

export interface UserStreak {
  id: number;
  user_id: number;
  current_streak: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatAttachment {
  name: string;
  uri: string;
  mime_type: string;
  display_name?: string;
  size_bytes?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: ChatAttachment[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  user_id: number;
  system_prompt?: string;
  context?: string;
  attachments?: ChatAttachment[];
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
}

export type ChatStreamTokenEvent = {
  type: 'token';
  delta: string;
};

export type ChatStreamEndEvent = {
  type: 'end';
  conversationId: string | null;
  response: string;
};

export type ChatStreamErrorEvent = {
  type: 'error';
  message: string;
};

export type ChatStreamEvent = ChatStreamTokenEvent | ChatStreamEndEvent | ChatStreamErrorEvent;

export interface ChatTitleResponse {
  title: string;
}

export interface GoogleAuthResponse {
  authorization_url: string;
  state?: string;
}

export interface GeminiFileMetadata {
  name: string;
  display_name?: string;
  mime_type?: string;
  uri?: string;
  download_uri?: string;
  size_bytes?: number;
  state?: string;
  create_time?: string;
  update_time?: string;
}

export interface UserCreate {
  email: string;
  full_name: string;
  profile_picture_url?: string;
  role?: string;
}

export interface UserUpdate {
  full_name?: string;
  profile_picture_url?: string;
  role?: string;
}

class ApiService {
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = resolveApiBaseUrl();
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${normalizedEndpoint}`;
    const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = new Headers(options.headers ?? undefined);
    if (!isFormDataBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return undefined as T;
      }

      return await response.json();
    } catch (error) {
      const baseUrl = resolveApiBaseUrl();

      if (error instanceof TypeError) {
        const normalizedMessage = error.message.toLowerCase();
        const isNetworkFailure =
          normalizedMessage.includes('failed to fetch') ||
          normalizedMessage.includes('fetch failed') ||
          normalizedMessage.includes('networkerror') ||
          normalizedMessage.includes('network request failed');

        if (isNetworkFailure) {
          console.error(`API network error (${endpoint} -> ${baseUrl}):`, error);
          throw new Error(
            `Unable to reach the API at ${baseUrl}. Verify that the backend service is running and accessible.`
          );
        }
      }

      console.error(`API Error (${endpoint} -> ${baseUrl}):`, error);
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

  // Calendar events
  async getUserCalendarEvents(userId: number): Promise<CalendarEvent[]> {
    return this.fetch<CalendarEvent[]>(`/users/${userId}/calendar-events`);
  }

  async createCalendarEvent(userId: number, eventData: {
    calendar_id?: number | null;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
  }): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(`/users/${userId}/calendar-events`, {
      method: 'POST',
      body: JSON.stringify(eventData),
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
  async getUserPlans(userId: number): Promise<Plan[]> {
    return this.fetch<Plan[]>(`/users/${userId}/plans`);
  }

  async updatePlan(userId: number, planId: number, updateData: Partial<Pick<Plan, 'label' | 'completed'>>): Promise<Plan> {
    return this.fetch<Plan>(`/users/${userId}/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  async deletePlan(userId: number, planId: number): Promise<void> {
    await this.fetch<void>(`/users/${userId}/plans/${planId}`, {
      method: 'DELETE',
    });
  }

  // Habits
  async getUserHabits(userId: number): Promise<Habit[]> {
    return this.fetch<Habit[]>(`/users/${userId}/habits`);
  }

  async updateHabit(userId: number, habitId: number, updateData: Partial<Pick<Habit, 'label' | 'streak_label' | 'previous_label'>>): Promise<Habit> {
    return this.fetch<Habit>(`/users/${userId}/habits/${habitId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  async deleteHabit(userId: number, habitId: number): Promise<void> {
    await this.fetch<void>(`/users/${userId}/habits/${habitId}`, {
      method: 'DELETE',
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

  // AI Chat endpoints
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.fetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
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
      throw new Error(detail);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      yield {
        type: 'end',
        conversationId: payload?.conversation_id ?? payload?.conversationId ?? null,
        response: payload?.response ?? payload?.text ?? '',
      };
      return;
    }

    if (!response.body) {
      throw new Error('Streaming response body is empty.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const parseSseEvent = (chunk: string): ChatStreamEvent | null => {
      const lines = chunk.split(/\r?\n/);
      let eventType = 'message';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (!line) {
          continue;
        }
        if (line.startsWith(':')) {
          continue;
        }
        if (line.startsWith('event:')) {
          eventType = line.slice('event:'.length).trim() || eventType;
          continue;
        }
        if (line.startsWith('data:')) {
          const separatorIndex = line.indexOf(':');
          const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : '';
          const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
          dataLines.push(value);
        }
      }

      const dataString = dataLines.join('\n');
      if (!dataString) {
        return null;
      }

      let payload: any = null;
      try {
        payload = JSON.parse(dataString);
      } catch {
        payload = { delta: dataString };
      }

      if (eventType === 'token') {
        const delta = payload?.delta ?? payload?.token ?? payload?.text ?? '';
        if (!delta) {
          return null;
        }
        return {
          type: 'token',
          delta,
        };
      }

      if (eventType === 'end') {
        return {
          type: 'end',
          conversationId: payload?.conversation_id ?? payload?.conversationId ?? null,
          response: payload?.response ?? payload?.text ?? '',
        };
      }

      if (eventType === 'error') {
        return {
          type: 'error',
          message: payload?.message ?? payload?.error ?? 'Stream error',
        };
      }

      if (payload?.delta ?? payload?.token ?? payload?.text) {
        return {
          type: 'token',
          delta: payload?.delta ?? payload?.token ?? payload?.text ?? '',
        };
      }

      return null;
    };

    const flushBuffer = (): ChatStreamEvent[] => {
      const events: ChatStreamEvent[] = [];
      while (true) {
        let delimiterIndex = buffer.indexOf('\n\n');
        let delimiterLength = 2;
        if (delimiterIndex === -1) {
          delimiterIndex = buffer.indexOf('\r\n\r\n');
          delimiterLength = 4;
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

  async generateChatTitle(message: string): Promise<ChatTitleResponse> {
    return this.fetch<ChatTitleResponse>('/api/chat/title', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getConversation(conversationId: string): Promise<ChatMessage[]> {
    return this.fetch<ChatMessage[]>(`/api/conversation/${conversationId}`);
  }

  async createConversation(title: string, userId: number): Promise<{ id: string; title: string; history: ChatMessage[] }> {
    return this.fetch('/api/conversation', {
      method: 'POST',
      body: JSON.stringify({ title, user_id: userId }),
    });
  }

  async uploadGeminiFile(file: File, displayName?: string): Promise<GeminiFileMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    if (displayName) {
      formData.append('display_name', displayName);
    }

    return this.fetch<GeminiFileMetadata>('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
  }
}

export const apiService = new ApiService();
