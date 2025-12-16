from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional
from pathlib import Path

from google import genai
from google.genai import types


class FileSearchService:
    def __init__(self, api_key: Optional[str]):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for File Search operations.")
        self._client = genai.Client(api_key=api_key)

    async def create_store(self, display_name: Optional[str] = None) -> types.FileSearchStore:
        config = {"display_name": display_name} if display_name else None
        return self._client.file_search_stores.create(config=config or {})

    async def upload_to_store(
        self,
        file_path: str,
        store_name: str,
        display_name: Optional[str] = None,
        chunking_config: Optional[Dict[str, Any]] = None,
        mime_type: Optional[str] = None,
    ) -> types.Operation:
        path_obj = Path(file_path)
        if not path_obj.exists() or not path_obj.is_file():
            raise FileNotFoundError(f"File not found for File Search upload: {file_path}")
        if path_obj.is_symlink():
            raise ValueError("Refusing to upload symlinked files to File Search.")
        resolved_path = path_obj.resolve()

        config: Dict[str, Any] = {}
        if display_name:
            config["display_name"] = display_name
        if chunking_config:
            config["chunking_config"] = chunking_config
        if mime_type:
            config["mime_type"] = mime_type

        # Retry logic for transient 5xx errors
        for attempt in range(3):
            try:
                return self._client.file_search_stores.upload_to_file_search_store(
                    file=str(resolved_path),
                    file_search_store_name=store_name,
                    config=config,
                )
            except Exception as e:
                # Check for 5xx server errors or internal errors
                code = getattr(e, "code", None)
                status_code = getattr(e, "status_code", None)
                
                is_server_error = (
                    (isinstance(code, int) and code >= 500) or
                    (isinstance(status_code, int) and status_code >= 500) or
                    "Internal error" in str(e) or
                    "INTERNAL" in str(e)
                )

                if is_server_error and attempt < 2:
                    wait_time = 1.0 * (2 ** attempt)
                    print(f"[FileSearch] Upload failed with {e}, retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                raise e

    async def import_file(
        self,
        store_name: str,
        file_name: str,
        chunking_config: Optional[Dict[str, Any]] = None,
    ) -> types.Operation:
        config: Dict[str, Any] = {}
        if chunking_config:
            config["chunking_config"] = chunking_config

        return self._client.file_search_stores.import_file(
            file_search_store_name=store_name,
            file_name=file_name,
            config=config,
        )

    async def get_operation(self, operation_name: str) -> types.Operation:
        return self._client.operations.get(operation_name)
