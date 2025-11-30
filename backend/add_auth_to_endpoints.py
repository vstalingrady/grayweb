#!/usr/bin/env python3
"""
Script to add authentication to all remaining endpoints in main.py

This script reads main.py, finds endpoints that need auth, and adds the required
authentication parameters and checks.
"""

import re
from pathlib import Path

# Read the main.py file
main_py_path = Path(__file__).parent / "main.py"
content = main_py_path.read_text()

# Define patterns to find and replace
ENDPOINTS_TO_FIX = [
    # (decorator_pattern, function_name, insert_after_param)
    (r'@app\.patch\("/users/\{user_id\}/calendars/\{calendar_id\}"', 'update_calendar', 'calendar_update: CalendarUpdate,'),
    (r'@app\.get\("/users/\{user_id\}/calendar-events"', 'get_user_calendar_events', 'user_id: int,'),
    (r'@app\.post\("/users/\{user_id\}/calendar-events"', 'create_calendar_event', 'event: CalendarEventCreate,'),
    (r'@app\.get\("/users/\{user_id\}/conversations"', 'list_user_conversations', 'user_id: int,'),
    (r'@app\.get\("/users/\{user_id\}/dashboard/pulses"', 'get_dashboard_pulses', 'user_id: int,'),
    (r'@app\.post\("/users/\{user_id\}/dashboard/pulses"', 'create_dashboard_pulse', 'user_id: int,'),
    (r'@app\.get\("/users/\{user_id\}/dashboard/pulses/\{date_key\}"', 'get_pulse_by_date', 'date_key: str,'),
    (r'@app\.get\("/users/\{user_id\}/dashboard/summary"', 'get_dashboard_summary', 'user_id: int,'),
    (r'@app\.get\("/users/\{user_id\}/proactivity"', 'get_proactivity_logs', 'user_id: int,'),
    (r'@app\.post\("/users/\{user_id\}/proactivity"', 'create_proactivity_log', 'user_id: int,'),
    (r'@app\.get\("/users/\{user_id\}/proactivity/settings"', 'get_proactivity_settings', 'user_id: int,'),
    (r'@app\.post\("/users/\{user_id\}/proactivity/subscription"', 'subscribe_proactivity', 'user_id: int,'),
    (r'@app\.post\("/users/\{user_id\}/push/subscribe"', 'push_subscribe', 'user_id: int,'),
    (r'@app\.get\("/users/\{user_id\}/streak"', 'get_user_streak', 'user_id: int,'),
    (r'@app\.post\("/users/\{user_id\}/streak"', 'update_user_streak', 'user_id: int,'),
    (r'@app\.post\("/users/\{user_id\}/google-calendar/auth"', 'google_calendar_auth', 'user_id: int,'),
    (r'@app\.get\("/users/\{user_id\}/google-calendars"', 'get_google_calendars', 'user_id: int,'),
    (r'@app\.get\("/users/\{user_id\}/google-calendars/\{calendar_id\}/events"', 'get_google_calendar_events', 'calendar_id: str,'),
    (r'@app\.delete\("/users/\{user_id\}"', 'delete_user_account', 'user_id: int,'),
]

AUTH_PARAM = '    current_user: Dict[str, Any] = Depends(get_current_user),'
AUTH_CHECK = '    require_same_user(user_id, current_user)'

def add_auth_to_endpoint(content: str, decorator_pattern: str, func_name: str, insert_after: str) -> str:
    """Add authentication to a specific endpoint"""
    # Find the function definition
    func_pattern = rf'({decorator_pattern}.*?)\nasync def {func_name}\((.*?)\):'
    
    match = re.search(func_pattern, content, re.DOTALL)
    if not match:
        print(f"⚠️  Could not find function: {func_name}")
        return content
    
    decorator = match.group(1)
    params = match.group(2)
    
    # Check if already has auth
    if 'current_user' in params:
        print(f"✓ Already has auth: {func_name}")
        return content
    
    # Add auth parameter after the specified parameter
    if insert_after in params:
        new_params = params.replace(
            insert_after,
            insert_after + '\n' + AUTH_PARAM
        )
    else:
        # Fallback: add before db parameter
        new_params = params.replace(
            'db: databases.Database = Depends(get_database)',
            AUTH_PARAM + '\n    db: databases.Database = Depends(get_database)'
        )
    
    # Replace the function signature
    old_signature = f'{decorator}\nasync def {func_name}({params}):'
    new_signature = f'{decorator}\nasync def {func_name}(\n{new_params}\n):'
    
    content = content.replace(old_signature, new_signature)
    
    # Add require_same_user check at the beginning of the function
    # Find the function body start
    func_body_pattern = rf'{decorator}\nasync def {func_name}\([^)]+\):\n'
    func_match = re.search(func_body_pattern, content, re.DOTALL)
    
    if func_match:
        insert_pos = func_match.end()
        # Insert the auth check
        content = content[:insert_pos] + AUTH_CHECK + '\n' + content[insert_pos:]
        print(f"✓ Added auth to: {func_name}")
    
    return content

# Apply all fixes
for decorator_pattern, func_name, insert_after in ENDPOINTS_TO_FIX:
    content = add_auth_to_endpoint(content, decorator_pattern, func_name, insert_after)

# Write the updated content
output_path = Path(__file__).parent / "main_with_auth.py"
output_path.write_text(content)

print(f"\n✅ Created {output_path}")
print("Review the file, then:")
print(f"  mv {output_path} {main_py_path}")
