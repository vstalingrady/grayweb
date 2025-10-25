const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  user_id: number;
  system_prompt?: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
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
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
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

  async getUserStreak(userId: number): Promise<UserStreak> {
    return this.fetch<UserStreak>(`/users/${userId}/streak`);
  }

  async touchUserStreak(userId: number): Promise<UserStreak> {
    return this.fetch<UserStreak>(`/users/${userId}/streak`, {
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

  async getConversation(conversationId: string): Promise<ChatMessage[]> {
    return this.fetch<ChatMessage[]>(`/api/conversation/${conversationId}`);
  }

  async createConversation(title: string, userId: number): Promise<{ id: string; title: string; history: ChatMessage[] }> {
    return this.fetch('/api/conversation', {
      method: 'POST',
      body: JSON.stringify({ title, user_id: userId }),
    });
  }
}

export const apiService = new ApiService();
