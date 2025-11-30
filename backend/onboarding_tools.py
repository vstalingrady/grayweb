from google.genai import types

# Import core tools so users can act immediately (create plans/reminders/habits) even during onboarding
try:
    from backend.plan_tools import PLAN_TOOLS
except ImportError:
    # Fallback if circular import or path issue (though backend.plan_tools should be available)
    from plan_tools import PLAN_TOOLS

COMPLETE_ONBOARDING_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="complete_onboarding",
            description="Complete the onboarding process by saving the user's basics for personalization.",
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
                },
                required=["nickname", "occupation", "about"],
            ),
        ),
    ]
)

ONBOARDING_TOOLS = [COMPLETE_ONBOARDING_TOOL] + PLAN_TOOLS
