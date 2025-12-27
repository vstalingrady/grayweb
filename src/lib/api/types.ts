import type { NotificationPreferences } from '../notificationPreferences';

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
  profile_picture_url?: string | null;
  role: string;
  plan_tier?: string | null;
  subscription_expires_at?: string | null;
  initials: string;
  workspace_background_id?: string | null;
  maps_enabled: boolean;
  improve_model_for_everyone?: boolean;
  has_seen_general_chat?: boolean;
  personalization_nickname?: string | null;
  personalization_occupation?: string | null;
  personalization_about?: string | null;
  personalization_custom_instructions?: string | null;
  personalization_system_prompt_override?: string | null;
  personalization_location?: string | null;
  personalization_time_zone?: string | null;
  created_at: string;
  updated_at: string;
  usage_status?: UsageStatus | null;
  preferred_model?: string | null;
  visible_model_ids?: string[] | null;
  theme_mode?: 'light' | 'dark' | 'system' | null;
  ui_locale?: 'en' | 'id' | null;
  preferred_response_language?: 'auto' | 'en' | 'id' | null;
  notification_preferences?: NotificationPreferences | null;
  conversation_memory_enabled?: boolean | null;
  auto_web_search_enabled?: boolean | null;
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
  reminder_minutes_before?: number | null;
  entry_type?: string;
  is_completed?: boolean;
  recurrence?: string;
  habit_id?: number;
  reminder_at?: string;
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
  reminder_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: number;
  user_id: number;
  label: string;
  previous_label: string;
  description?: string | null;
  reminder_at?: string | null;
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
  timestamp?: number;
  attachments?: MediaUpload[];
}

export interface ConversationHistoryPage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface MediaUpload {
  id: number;
  user_id: number;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
  previewUrl?: string;
  public_url?: string;
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

export interface ChatGptImportResponse {
  context_cache_id: number;
  label: string;
  summary_preview: string;
  conversation_count: number;
  message_count: number;
  user_message_count: number;
  fact_count: number;
  title_count: number;
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
  reminders_enabled?: boolean;
  conversation_memory_enabled?: boolean;
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
  metadata?: Record<string, unknown>;
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
  /** Model-specific context limit (may be lower than tier limit for some Pioneer models) */
  modelLimit?: number;
  provider: string;
  modelName?: string | null;
  modelLabel?: string | null;
  /** Warning message when context exceeds model limit */
  contextWarning?: string | null;
  /** Suggested models with higher context limits */
  suggestedModels?: Array<{
    model_id: string;
    name: string;
    context_limit: number;
  }> | null;
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

export type ChatStreamUsageEvent = {
  type: 'usage';
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
    total_cost?: number; // OpenRouter specific
  };
};

export type ChatStreamEvent = ChatStreamTokenEvent | ChatStreamEndEvent | ChatStreamErrorEvent | ChatStreamRemindersEvent | ChatStreamUsageEvent;

export interface GoogleAuthResponse {
  authorization_url: string;
  state?: string;
}

export interface GoogleCalendarInfo {
  id: string;
  email: string;
  summary: string;
  description?: string | null;
  timezone?: string | null;
  primary?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string | null;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string | null;
  visibility?: string | null;
  transparency?: string | null;
  color_id?: string | null;
  reminders?: unknown;
}

export interface UserCreate {
  email: string;
  full_name: string;
  profile_picture_url?: string;
  workspace_background_id?: string | null;
}

export interface UserUpdate {
  full_name?: string;
  profile_picture_url?: string;
  workspace_background_id?: string | null;
  maps_enabled?: boolean;
  improve_model_for_everyone?: boolean;
  has_seen_general_chat?: boolean;
  personalization_nickname?: string | null;
  personalization_occupation?: string | null;
  personalization_about?: string | null;
  personalization_custom_instructions?: string | null;
  personalization_system_prompt_override?: string | null;
  personalization_location?: string | null;
  personalization_time_zone?: string | null;
  preferred_model?: string | null;
  visible_model_ids?: string[] | null;
  theme_mode?: 'light' | 'dark' | 'system' | null;
  ui_locale?: 'en' | 'id' | null;
  preferred_response_language?: 'auto' | 'en' | 'id' | null;
  notification_preferences?: NotificationPreferences | null;
  conversation_memory_enabled?: boolean | null;
  auto_web_search_enabled?: boolean | null;
}

export interface AnalyticsSummary {
  generated_at: string;
  counts?: Record<string, number | null>;
  user_growth?: {
    total_users: number;
    plan_distribution: Record<string, number>;
    new_7d: number;
    new_30d: number;
  };
  engagement?: {
    dau: number;
    wau: number;
    mau: number;
    total_general_messages: number;
    total_thread_messages: number;
    avg_messages_per_user: number;
  };
  feature_adoption?: {
    users_with_plans: number;
    users_with_habits: number;
    active_reminders: number;
    calendar_events: number;
    push_subscriptions: number;
  };
  retention?: {
    active_today: number;
  };
  churn?: {
    eligible_30d: number;
    active_30d: number;
    inactive_30d: number;
    churn_rate_30d: number;
  };
  revenue?: {
    by_status: Record<string, number>;
    by_plan: Record<string, number>;
    conversion_rate: number;
  };
  database_url?: string;
  sqlite_path?: string | null;
  sqlite_size_bytes?: number | null;
}
