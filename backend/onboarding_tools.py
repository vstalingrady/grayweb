from google.genai import types

COMPLETE_ONBOARDING_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="complete_onboarding",
            description=(
                "Save onboarding progress (preferred name, occupation, and about blurb) and optionally "
                "the user's preferred proactivity cadence. This tool can be called multiple times as "
                "new details are learned; onboarding is considered complete once nickname, occupation, "
                "and about are all present."
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
            ),
        ),
    ]
)

ONBOARDING_TOOLS = [COMPLETE_ONBOARDING_TOOL]
