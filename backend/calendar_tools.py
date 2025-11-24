from google.genai import types


CALENDAR_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="list_calendar_events",
            description="List calendar events for the current user, optionally filtered by date range.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "start_date": types.Schema(
                        type="STRING",
                        description="Start date (ISO 8601 format, e.g., '2023-10-27T00:00:00Z'). Defaults to now if omitted.",
                    ),
                    "end_date": types.Schema(
                        type="STRING",
                        description="End date (ISO 8601 format). Defaults to 7 days from start_date if omitted.",
                    ),
                    "calendar_id": types.Schema(
                        type="INTEGER",
                        description="Optional ID of a specific calendar to filter by.",
                    ),
                },
                required=[],
            ),
        ),
        types.FunctionDeclaration(
            name="create_calendar_event",
            description="Create a new calendar event.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "title": types.Schema(
                        type="STRING",
                        description="The title of the event.",
                    ),
                    "start_time": types.Schema(
                        type="STRING",
                        description="Start time of the event (ISO 8601 format).",
                    ),
                    "end_time": types.Schema(
                        type="STRING",
                        description="End time of the event (ISO 8601 format).",
                    ),
                    "description": types.Schema(
                        type="STRING",
                        description="Optional description of the event.",
                    ),
                    "calendar_id": types.Schema(
                        type="INTEGER",
                        description="Optional ID of the calendar to add the event to.",
                    ),
                },
                required=["title", "start_time", "end_time"],
            ),
        ),
        types.FunctionDeclaration(
            name="update_calendar_event",
            description="Update an existing calendar event.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "event_id": types.Schema(
                        type="INTEGER",
                        description="The ID of the event to update.",
                    ),
                    "title": types.Schema(
                        type="STRING",
                        description="New title for the event.",
                    ),
                    "start_time": types.Schema(
                        type="STRING",
                        description="New start time (ISO 8601 format).",
                    ),
                    "end_time": types.Schema(
                        type="STRING",
                        description="New end time (ISO 8601 format).",
                    ),
                    "description": types.Schema(
                        type="STRING",
                        description="New description.",
                    ),
                    "calendar_id": types.Schema(
                        type="INTEGER",
                        description="New calendar ID.",
                    ),
                },
                required=["event_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="delete_calendar_event",
            description="Delete a calendar event.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "event_id": types.Schema(
                        type="INTEGER",
                        description="The ID of the event to delete.",
                    ),
                },
                required=["event_id"],
            ),
        )
    ]
)

# Export as a list to maintain compatibility with main.py unpacking
CALENDAR_TOOLS = [CALENDAR_TOOL]
