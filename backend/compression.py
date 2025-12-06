"""Response compression middleware for FastAPI.

Adds gzip compression for large responses to reduce bandwidth.
"""

import gzip
from io import BytesIO
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import StreamingResponse

# Minimum size to compress (bytes)
MIN_SIZE = 1000

# Content types to compress
COMPRESSIBLE_TYPES = {
    "application/json",
    "text/html",
    "text/plain",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/xml",
    "text/xml",
}


class CompressionMiddleware(BaseHTTPMiddleware):
    """Middleware that compresses responses using gzip."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if client accepts gzip
        accept_encoding = request.headers.get("Accept-Encoding", "")
        if "gzip" not in accept_encoding.lower():
            return await call_next(request)
        
        response = await call_next(request)
        
        # Don't compress streaming responses
        if isinstance(response, StreamingResponse):
            return response
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        base_type = content_type.split(";")[0].strip()
        
        if base_type not in COMPRESSIBLE_TYPES:
            return response
        
        # Get response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk
        
        # Don't compress small responses
        if len(body) < MIN_SIZE:
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
        
        # Compress
        buffer = BytesIO()
        with gzip.GzipFile(mode="wb", fileobj=buffer, compresslevel=6) as gz:
            gz.write(body)
        
        compressed = buffer.getvalue()
        
        # Only use compressed if it's actually smaller
        if len(compressed) >= len(body):
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
        
        headers = dict(response.headers)
        headers["Content-Encoding"] = "gzip"
        headers["Content-Length"] = str(len(compressed))
        # Remove any existing Vary header and add our own
        headers["Vary"] = "Accept-Encoding"
        
        return Response(
            content=compressed,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )
