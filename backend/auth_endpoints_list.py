"""
Helper script to generate authentication patches for remaining endpoints.

This script identifies all endpoints in main.py that need authentication
and generates the appropriate patches.
"""

ENDPOINTS_TO_AUTH = [
    # Habits endpoints
    ("/users/{user_id}/habits", "GET", "get_habits"),
    ("/users/{user_id}/habits", "POST", "create_habit"),
    ("/users/{user_id}/habits/{habit_id}", "PUT", "update_habit"),
    ("/users/{user_id}/habits/{habit_id}", "DELETE", "delete_habit"),
    
    # Reminders endpoints
    ("/users/{user_id}/reminders", "GET", "get_reminders"),
    ("/users/{user_id}/reminders", "POST", "create_reminder"),
    ("/users/{user_id}/reminders/{reminder_id}", "PUT", "update_reminder"),
    ("/users/{user_id}/reminders/{reminder_id}", "DELETE", "delete_reminder"),
    
    # Calendar events endpoints
    ("/users/{user_id}/calendar-events", "GET", "get_calendar_events"),
    ("/users/{user_id}/calendar-events", "POST", "create_calendar_event"),
    ("/users/{user_id}/calendar-events/{event_id}", "PUT", "update_calendar_event"),
    ("/users/{user_id}/calendar-events/{event_id}", "DELETE", "delete_calendar_event"),
    
    # Conversation endpoints
    ("/api/conversation/{conversation_id}", "GET", "get_conversation"),
    ("/api/conversation/{conversation_id}/messages", "POST", "add_conversation_message"),
    ("/api/conversation/{conversation_id}/metadata", "POST", "update_conversation_metadata"),
    ("/api/conversation/{conversation_id}/usage", "GET", "get_conversation_usage"),
    ("/users/{user_id}/conversations", "GET", "get_conversations"),
    
    # Dashboard & pulse endpoints
    ("/users/{user_id}/dashboard/pulses", "GET", "get_dashboard_pulses"),
    ("/users/{user_id}/dashboard/pulses", "POST", "create_dashboard_pulse"),
    ("/users/{user_id}/dashboard/pulses/{date_key}", "GET", "get_dashboard_pulse_by_date"),
    ("/users/{user_id}/dashboard/summary", "GET", "get_dashboard_summary"),
    
    # Proactivity endpoints
    ("/users/{user_id}/proactivity", "GET", "get_proactivity_logs"),
    ("/users/{user_id}/proactivity", "POST", "create_proactivity_log"),
    ("/users/{user_id}/proactivity/settings", "GET", "get_proactivity_settings"),
    ("/users/{user_id}/proactivity/subscription", "POST", "subscribe_proactivity"),
    ("/users/{user_id}/push/subscribe", "POST", "push_subscribe"),
    
    # Calendar endpoints
    ("/users/{user_id}/calendars", "GET", "get_calendars"),
    ("/users/{user_id}/calendars", "POST", "create_calendar"),
    ("/users/{user_id}/calendars/{calendar_id}", "PATCH", "update_calendar"),
    
    # Google Calendar endpoints
    ("/users/{user_id}/google-calendar/auth", "POST", "google_calendar_auth"),
    ("/users/{user_id}/google-calendars", "GET", "get_google_calendars"),
    ("/users/{user_id}/google-calendars/{calendar_id}/events", "GET", "get_google_calendar_events"),
    
    # Chat sessions
    ("/users/{user_id}/chat-sessions", "GET", "get_chat_sessions"),
    ("/users/{user_id}/chat-sessions", "POST", "create_chat_session"),
    
    # User streak
    ("/users/{user_id}/streak", "GET", "get_user_streak"),
    ("/users/{user_id}/streak", "POST", "update_user_streak"),
    
    # Delete user
    ("/users/{user_id}", "DELETE", "delete_user_account"),
]

# Generate the authentication pattern for each endpoint type
def generate_auth_patch(endpoint, method, function_name):
    has_user_id = "{user_id}" in endpoint
    
    if has_user_id:
        return f"""
# Add to {function_name}:
current_user: Dict[str, Any] = Depends(get_current_user),

# Add after function definition:
require_same_user(user_id, current_user)
"""
    else:
        # For conversation endpoints without user_id in path
        return f"""
# Add to {function_name}:
current_user: Dict[str, Any] = Depends(get_current_user),

# Verify conversation ownership in function body
"""

if __name__ == "__main__":
    print("Authentication needed for the following endpoints:")
    print("=" * 80)
    for endpoint, method, func in ENDPOINTS_TO_AUTH:
        print(f"{method:6} {endpoint:50} ({func})")
    print("=" * 80)
    print(f"Total: {len(ENDPOINTS_TO_AUTH)} endpoints")
