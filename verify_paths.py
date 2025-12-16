
import sys
import os
from pathlib import Path

# Add root to sys.path
sys.path.insert(0, "/home/vstaln/gray")

try:
    from backend.database import _select_database_url
    from backend.env_utils import IN_DOCKER, ROOT_DIR

    print(f"IN_DOCKER: {IN_DOCKER}")
    print(f"ROOT_DIR: {ROOT_DIR}")
    print(f"DATABASE_URL: {_select_database_url()}")
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Error: {e}")
