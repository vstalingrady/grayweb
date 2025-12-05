from google.genai import types

COMPLETE_ONBOARDING_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="complete_onboarding",
            description=(
                "Complete the onboarding process by saving the user's basics for personalization "
                "and optionally their preferred proactivity cadence."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "nickname": types.Schema(
                        type="STRING",
                        description="What the user wants to be called.",
                    ),
                    "occupation": types.Schema(
                        type="STRING",
                        description="What the user does (role, field, or focus).",
                    ),
                    "about": types.Schema(
                        type="STRING",
                        description="A short blurb about the user (interests, goals, working style).",
                    ),
                    "core_blocker": types.Schema(
                        type="STRING",
                        description="If the user volunteered a blocker or challenge, capture it here.",
                    ),
                    "proactivity_cadence": types.Schema(
                        type="STRING",
                        description=(
                            "How often Gray should proactively check in with the user. "
                            "Expected values: 'frequent', 'daily', 'weekly', 'manual', or 'custom'."
                        ),
                    ),
                    "proactivity_time": types.Schema(
                        type="STRING",
                        description=(
                            "Preferred local time of day for check-ins in 24-hour 'HH:MM' format "
                            "(e.g. '09:00'). If omitted, Gray will default to a reasonable time."
                        ),
                    ),
                    "proactivity_timezone": types.Schema(
                        type="STRING",
                        description=(
                            "User's IANA timezone identifier (e.g. 'America/Los_Angeles', 'UTC'). "
                            "Optional; when omitted, Gray will infer the timezone."
                        ),
                    ),
                },
                required=["nickname", "occupation", "about"],
            ),
        ),
    ]
)

ONBOARDING_TOOLS = [COMPLETE_ONBOARDING_TOOL]
