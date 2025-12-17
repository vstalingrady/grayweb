import { ApiError } from "./errors";
import { sendChatMessageStream } from "./chatStream";
import { apiFetch } from "./request";
import type {
  ApiKey,
  ApiKeyCreate,
  Calendar,
  CalendarEvent,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatSession,
  ChatStarterRequest,
  ChatStarterResponse,
  ChatStreamEvent,
  ContextCache,
  ContextCacheBase,
  ConversationSummary,
  ConversationUpdatePayload,
  ConversationUsage,
  DashboardPulse,
  DashboardPulseHabitItem,
  DashboardPulsePlanItem,
  DashboardPulseProactivity,
  FileSearchUploadResponse,
  GoogleAuthResponse,
  GoogleCalendarEvent,
  GoogleCalendarInfo,
  Habit,
  MediaUpload,
  Plan,
  ProactivityNotification,
  ProactivitySettings,
  Reminder,
  ReminderCreatePayload,
  ReminderStatus,
  ReminderUpdatePayload,
  User,
  UserCreate,
  UserUpdate,
  WorkspaceBackground,
  WorkspaceBackgroundAssetUploadResponse,
  WorkspaceBackgroundCreate
} from "./types";

class ApiService {
  private fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return apiFetch<T>(endpoint, options);
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
      if (error instanceof ApiError && error.status === 404) {
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



  async getUserCalendars(userId: number): Promise<Calendar[]> {
    return this.fetch<Calendar[]>(`/users/${userId}/calendars`);
  }

  async updateCalendar(userId: number, calendarId: number, updateData: Partial<Pick<Calendar, 'label' | 'color' | 'is_visible'>>): Promise<Calendar> {
    return this.fetch<Calendar>(`/users/${userId}/calendars/${calendarId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  // Calendar events
  async getCalendarEvents(userId: number, calendarId?: number): Promise<CalendarEvent[]> {
    const query = calendarId ? `?calendar_id=${calendarId}` : '';
    return this.fetch<CalendarEvent[]>(`users/${userId}/calendar_events${query}`);
  }

  async createCalendarEvent(userId: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(`users/${userId}/calendar_events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateCalendarEvent(userId: number, eventId: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(`users/${userId}/calendar_events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(event),
    });
  }

  async deleteCalendarEvent(userId: number, eventId: number): Promise<void> {
    return this.fetch<void>(`users/${userId}/calendar_events/${eventId}`, {
      method: 'DELETE',
    });
  }

  // Plans
  async getPlans(userId: number, limit?: number): Promise<Plan[]> {
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
      reminderAt?: string | null;
      color?: string | null;
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
    if ("reminderAt" in updateData) {
      payload.reminder_at = updateData.reminderAt ?? null;
    }
    if ("color" in updateData) {
      payload.color = updateData.color ?? null;
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
      reminderAt?: string | null;
      color?: string | null;
    }
  ): Promise<Plan> {
    const payload = {
      label: planData.label,
      completed: planData.completed ?? false,
      deadline: planData.deadline ?? null,
      schedule_slot: planData.scheduleSlot ?? null,
      description: planData.description ?? null,
      reminder_at: planData.reminderAt ?? null,
      color: planData.color ?? null,
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
      previous_label?: string | null;
      description?: string | null;
      reminderAt?: string | null;
    }
  ): Promise<Habit> {
    const payload = {
      label: habitData.label,
      previous_label: habitData.previous_label ?? "No history yet",
      description: habitData.description ?? null,
      reminder_at: habitData.reminderAt ?? null,
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
      previous_label?: string | null;
      description?: string | null;
      reminderAt?: string | null;
    }
  ): Promise<Habit> {
    const payload: Record<string, unknown> = {};
    if (typeof updateData.label === "string") {
      payload.label = updateData.label;
    }
    if ("previous_label" in updateData) {
      payload.previous_label = updateData.previous_label ?? null;
    }
    if ("description" in updateData) {
      payload.description = updateData.description ?? null;
    }
    if ("reminderAt" in updateData) {
      payload.reminder_at = updateData.reminderAt ?? null;
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

  async listUploads(options?: { limit?: number; offset?: number }): Promise<MediaUpload[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.offset) {
      params.set('offset', String(options.offset));
    }
    const suffix = params.toString();
    const endpoint = suffix ? `/api/uploads?${suffix}` : '/api/uploads';
    return this.fetch<MediaUpload[]>(endpoint);
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

  async getGoogleCalendars(userId: number): Promise<GoogleCalendarInfo[]> {
    return this.fetch<GoogleCalendarInfo[]>(`/users/${userId}/google-calendars`);
  }

  async getGoogleCalendarEvents(
    userId: number,
    calendarId: string,
    options?: { timeMin?: string; timeMax?: string }
  ): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams();
    if (options?.timeMin) {
      params.set('time_min', options.timeMin);
    }
    if (options?.timeMax) {
      params.set('time_max', options.timeMax);
    }
    const suffix = params.toString();
    const encodedCalendarId = encodeURIComponent(calendarId);
    const endpoint = suffix
      ? `/users/${userId}/google-calendars/${encodedCalendarId}/events?${suffix}`
      : `/users/${userId}/google-calendars/${encodedCalendarId}/events`;
    return this.fetch<GoogleCalendarEvent[]>(endpoint);
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

  sendMessageStream(
    request: ChatRequest,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    return sendChatMessageStream(request, options);
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

  /**
   * Delete all conversations and messages for the user.
   */
  async deleteAllConversations(userId: number): Promise<void> {
    await this.fetch<void>(`/users/${userId}/conversations`, {
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
    await this.fetch(`/api/conversation/${encodeURIComponent(conversationId)}/messages`, {
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
    try {
      return await this.fetch<ChatMessage[]>(`/api/conversation/${encodeURIComponent(conversationId)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async getConversationUsage(conversationId: string): Promise<ConversationUsage | null> {
    try {
      const payload = await this.fetch<{
        conversation_id: string;
        message_count: number;
        conversation_tokens: number;
        limit: number;
        model_limit?: number;
        provider: string;
        model_name?: string | null;
        model_label?: string | null;
        context_warning?: string | null;
        suggested_models?: Array<{
          model_id: string;
          name: string;
          context_limit: number;
        }> | null;
      }>(`/api/conversation/${encodeURIComponent(conversationId)}/usage`);

      const normalizedLimit =
        typeof payload.limit === "number" && Number.isFinite(payload.limit)
          ? payload.limit
          : 0;

      return {
        conversationId: payload.conversation_id,
        messageCount: payload.message_count,
        conversationTokens: payload.conversation_tokens,
        limit: normalizedLimit,
        modelLimit: payload.model_limit,
        provider: payload.provider ?? "local",
        modelName: payload.model_name ?? null,
        modelLabel: payload.model_label ?? null,
        contextWarning: payload.context_warning ?? null,
        suggestedModels: payload.suggested_models ?? null,
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
