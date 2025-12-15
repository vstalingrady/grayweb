from google.genai import types


PLAN_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="list_plans",
            description="List active plans for the current user.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "limit": types.Schema(
                        type="INTEGER",
                        description="Optional limit on the number of plans to return.",
                    ),
                },
                required=[],
            ),
        ),
        types.FunctionDeclaration(
            name="create_plan",
            description="Create a new plan. Reminders are plans with an optional reminder_at.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "label": types.Schema(
                        type="STRING",
                        description="The title or label of the plan.",
                    ),
                    "description": types.Schema(
                        type="STRING",
                        description="Optional description of the plan.",
                    ),
                    "deadline": types.Schema(
                        type="STRING",
                        description="Optional deadline for the plan.",
                    ),
                    "schedule_slot": types.Schema(
                        type="STRING",
                        description="Optional schedule slot (e.g. 'Morning', 'Evening').",
                    ),
                    "reminder_at": types.Schema(
                        type="STRING",
                        description="Optional reminder time (ISO 8601 with timezone offset). Leave empty or omit for no reminder.",
                    ),
                },
                required=["label"],
            ),
        ),
        types.FunctionDeclaration(
            name="delete_plan",
            description="Delete a plan.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "plan_id": types.Schema(
                        type="INTEGER",
                        description="The ID of the plan to delete.",
                    ),
                },
                required=["plan_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="update_plan",
            description="Update an existing plan.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "plan_id": types.Schema(
                        type="INTEGER",
                        description="The ID of the plan to update.",
                    ),
                    "label": types.Schema(
                        type="STRING",
                        description="New label for the plan.",
                    ),
                    "description": types.Schema(
                        type="STRING",
                        description="New description.",
                    ),
                    "completed": types.Schema(
                        type="BOOLEAN",
                        description="Mark as completed or not.",
                    ),
                    "deadline": types.Schema(
                        type="STRING",
                        description="New deadline.",
                    ),
                    "schedule_slot": types.Schema(
                        type="STRING",
                        description="New schedule slot.",
                    ),
                    "reminder_at": types.Schema(
                        type="STRING",
                        description="Optional reminder time (ISO 8601 with timezone offset). Set to empty string to clear.",
                    ),
                },
                required=["plan_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="list_habits",
            description="List habits for the current user.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "limit": types.Schema(
                        type="INTEGER",
                        description="Optional limit on the number of habits to return.",
                    ),
                },
                required=[],
            ),
        ),
        types.FunctionDeclaration(
            name="create_habit",
            description="Create a new habit.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "label": types.Schema(
                        type="STRING",
                        description="The name or label of the habit.",
                    ),
                    "description": types.Schema(
                        type="STRING",
                        description="Optional description of the habit.",
                    ),
                    "streak_days": types.Schema(
                        type="INTEGER",
                        description="Optional streak count in consecutive days (integer only).",
                    ),
                    "reminder_at": types.Schema(
                        type="STRING",
                        description="Optional reminder time (ISO 8601 with timezone offset). Leave empty or omit for no reminder.",
                    ),
                },
                required=["label"],
            ),
        ),
        types.FunctionDeclaration(
            name="update_habit",
            description="Update an existing habit.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "habit_id": types.Schema(
                        type="INTEGER",
                        description="The ID of the habit to update.",
                    ),
                    "label": types.Schema(
                        type="STRING",
                        description="New label for the habit.",
                    ),
                    "description": types.Schema(
                        type="STRING",
                        description="New description.",
                    ),
                    "streak_days": types.Schema(
                        type="INTEGER",
                        description="New streak count in consecutive days (integer).",
                    ),
                    "reminder_at": types.Schema(
                        type="STRING",
                        description="Optional reminder time (ISO 8601 with timezone offset). Set to empty string to clear.",
                    ),
                },
                required=["habit_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="delete_habit",
            description="Delete a habit.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "habit_id": types.Schema(
                        type="INTEGER",
                        description="The ID of the habit to delete.",
                    ),
                },
                required=["habit_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="list_reminders",
            description="List reminders for the current user.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "limit": types.Schema(
                        type="INTEGER",
                        description="Optional limit on the number of reminders to return.",
                    ),
                    "status": types.Schema(
                        type="STRING",
                        description='Optional status filter such as "pending" or "delivered".',
                    ),
                    "include_archived": types.Schema(
                        type="BOOLEAN",
                        description="Whether to include completed/cancelled reminders.",
                    ),
                    "delivery_mode": types.Schema(
                        type="STRING",
                        description='Optional delivery mode filter such as "reminder".',
                    ),
                    "entity_type": types.Schema(
                        type="STRING",
                        description='Optional entity type filter such as "plan" or "habit".',
                    ),
                },
                required=[],
            ),
        ),
        types.FunctionDeclaration(
            name="get_workspace_state",
            description="Fetch a lightweight snapshot of plans, habits, and reminders for the current user.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "plan_limit": types.Schema(
                        type="INTEGER",
                        description="Optional limit on plans to include.",
                    ),
                    "habit_limit": types.Schema(
                        type="INTEGER",
                        description="Optional limit on habits to include.",
                    ),
                    "reminder_limit": types.Schema(
                        type="INTEGER",
                        description="Optional limit on reminders to include.",
                    ),
                    "include_archived_reminders": types.Schema(
                        type="BOOLEAN",
                        description="Whether to include completed/cancelled reminders.",
                    ),
                },
                required=[],
            ),
        ),
    ]
)

# Export as a list to maintain compatibility with main.py unpacking
PLAN_TOOLS = [PLAN_TOOL]
