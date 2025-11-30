#!/usr/bin/env python3
from supabase import create_client
import os

url = os.getenv('SUPABASE_URL', 'http://127.0.0.1:54321')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU')
supabase = create_client(url, key)

# Check user 1 state
result = supabase.table('users').select('*').eq('id', 1).execute()
if result.data:
    user = result.data[0]
    print('=== User ID 1 Profile ===')
    print(f'Email: {user.get("email")}')
    print(f'Nickname: {repr(user.get("personalization_nickname"))}')
    print(f'Occupation: {repr(user.get("personalization_occupation"))}')
    print(f'About: {repr(user.get("personalization_about"))}')
    print(f'has_seen_general_chat: {repr(user.get("has_seen_general_chat"))}')
    print(f'Updated: {user.get("updated_at")}')
    
    # Check recent conversation messages
    print('\n=== Recent Conversation Messages ===')
    conv_result = supabase.table('conversations').select('conversation_id, user_id').eq('user_id', 1).limit(5).execute()
    if conv_result.data:
        for conv in conv_result.data:
            print(f'\nConversation: {conv.get("conversation_id")}')
            msg_result = supabase.table('conversation_messages').select('role, text').eq('conversation_id', conv.get("conversation_id")).order('timestamp').limit(10).execute()
            for msg in msg_result.data:
                role = msg.get('role', 'unknown')
                text = (msg.get('text', '') or '')[:100]
                print(f'  [{role}]: {text}')
