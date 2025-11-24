from google.genai import types

COMPLETE_ONBOARDING_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="complete_onboarding",
            description="Complete the onboarding process by logging the user's core blocker.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "core_blocker": types.Schema(
                        type="STRING",
                        description="A specific and concrete summary of the user's core blocker.",
                    ),
                },
                required=["core_blocker"],
            ),
        ),
    ]
)

ONBOARDING_TOOLS = [COMPLETE_ONBOARDING_TOOL]
