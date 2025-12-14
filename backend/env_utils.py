"""
Centralized environment detection utilities.

Consolidates Docker detection and path resolution that was previously
duplicated across database.py, main.py, start.py, and ai_message_generator.py.
"""
from pathlib import Path

# Detect if running inside Docker container
# In Docker, backend files are at /app/*.py, so parent of /app is /
_file_dir = Path(__file__).resolve().parent
IN_DOCKER = _file_dir.parent == Path("/")

# Root directory for the application
# In Docker: /app
# Locally: parent of backend/ (the project root)
ROOT_DIR = _file_dir if IN_DOCKER else _file_dir.parent

# Uvicorn app module path
# In Docker: main.py is directly at /app/main.py, so use "main:app"
# Locally: main.py is at backend/main.py, so use "backend.main:app"
UVICORN_APP_MODULE = "main:app" if IN_DOCKER else "backend.main:app"

__all__ = ["IN_DOCKER", "ROOT_DIR", "UVICORN_APP_MODULE"]
