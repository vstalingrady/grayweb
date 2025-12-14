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
                    "proactivity_cadence": types.Schema(
                        type="STRING",
                        description=(
                            "How often Gray should proactively check in with the user. "
                            "Expected values: 'frequent', 'daily', 'weekly', 'manual', or 'custom'."
                        ),
                    ),
                },
                required=["nickname", "occupation", "about"],
            ),
        ),
    ]
)

ONBOARDING_TOOLS = [COMPLETE_ONBOARDING_TOOL]
