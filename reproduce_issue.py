
from backend.core.message_detection import should_enable_search, should_use_web_search

messages = [
    "wtf",
    "what is wtf",
    "what does wtf mean",
    "search for wtf",
    "weather in sf",
]

print("--- Testing Search Heuristics ---")
for msg in messages:
    enable = should_enable_search(msg)
    use = should_use_web_search(msg)
    print(f"Message: '{msg}' -> enable_search={enable}, use_web_search={use}")
