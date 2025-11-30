import sys
import os
import traceback

print(f"CWD: {os.getcwd()}")
print(f"sys.path: {sys.path}")

try:
    print("Attempting: from backend.ai_message_generator import AIMessageGenerator")
    from backend.ai_message_generator import AIMessageGenerator
    print("Success: backend.ai_message_generator")
except ImportError:
    print("Failed backend.ai_message_generator. Traceback:")
    traceback.print_exc()
