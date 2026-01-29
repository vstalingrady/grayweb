from google.genai import types

from backend.supermemory import MEMORY_CATEGORIES

_CATEGORY_HINT = ", ".join(MEMORY_CATEGORIES)

SUPERMEMORY_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="supermemory_store",
            description="Save important information to long-term memory.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "text": types.Schema(
                        type="STRING",
                        description="Information to remember.",
                    ),
                    "category": types.Schema(
                        type="STRING",
                        description=f"Optional category hint. Suggested values: {_CATEGORY_HINT}.",
                    ),
                },
                required=["text"],
            ),
        ),
        types.FunctionDeclaration(
            name="supermemory_search",
            description="Search long-term memories for relevant information.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query": types.Schema(
                        type="STRING",
                        description="Search query.",
                    ),
                    "limit": types.Schema(
                        type="INTEGER",
                        description="Max results (default: 5).",
                    ),
                },
                required=["query"],
            ),
        ),
        types.FunctionDeclaration(
            name="supermemory_forget",
            description="Forget/delete a specific memory by query or id.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query": types.Schema(
                        type="STRING",
                        description="Describe the memory to forget.",
                    ),
                    "memory_id": types.Schema(
                        type="STRING",
                        description="Direct memory id to delete.",
                    ),
                },
                required=[],
            ),
        ),
        types.FunctionDeclaration(
            name="supermemory_profile",
            description="Get a summary of what is known about the user.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query": types.Schema(
                        type="STRING",
                        description="Optional query to focus the profile.",
                    ),
                },
                required=[],
            ),
        ),
    ]
)

SUPERMEMORY_TOOLS = [SUPERMEMORY_TOOL]
