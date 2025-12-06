"""Structured error responses for consistent API error handling.

Provides standardized error format across all API endpoints.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import traceback
from typing import Any, Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base exception for API errors with structured response."""
    
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.details = details or {}
        super().__init__(message)


class ValidationError(APIError):
    """400 - Validation error."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(400, "VALIDATION_ERROR", message, details)


class AuthenticationError(APIError):
    """401 - Authentication required or failed."""
    def __init__(self, message: str = "Authentication required"):
        super().__init__(401, "AUTHENTICATION_REQUIRED", message)


class AuthorizationError(APIError):
    """403 - Permission denied."""
    def __init__(self, message: str = "Access denied"):
        super().__init__(403, "ACCESS_DENIED", message)


class NotFoundError(APIError):
    """404 - Resource not found."""
    def __init__(self, resource: str, identifier: Any = None):
        details = {"resource": resource}
        if identifier:
            details["identifier"] = str(identifier)
        super().__init__(404, "NOT_FOUND", f"{resource} not found", details)


class RateLimitError(APIError):
    """429 - Rate limit exceeded."""
    def __init__(self, retry_after: int = 60):
        super().__init__(
            429, 
            "RATE_LIMIT_EXCEEDED", 
            f"Too many requests. Retry after {retry_after} seconds.",
            {"retry_after": retry_after}
        )


class InternalError(APIError):
    """500 - Internal server error."""
    def __init__(self, message: str = "An internal error occurred"):
        super().__init__(500, "INTERNAL_ERROR", message)


def error_response(
    status_code: int,
    error_code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
) -> JSONResponse:
    """Create a structured error response."""
    body = {
        "error": {
            "code": error_code,
            "message": message,
            "status": status_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    }
    
    if details:
        body["error"]["details"] = details
    
    if request_id:
        body["error"]["request_id"] = request_id
    
    return JSONResponse(status_code=status_code, content=body)


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    """Handle APIError exceptions."""
    logger.warning(
        f"API Error: {exc.error_code} - {exc.message}",
        extra={
            "error_code": exc.error_code,
            "status_code": exc.status_code,
            "path": request.url.path,
        }
    )
    return error_response(
        exc.status_code,
        exc.error_code,
        exc.message,
        exc.details,
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Convert FastAPI HTTPException to structured format."""
    error_codes = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMIT_EXCEEDED",
        500: "INTERNAL_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
    }
    
    error_code = error_codes.get(exc.status_code, "ERROR")
    
    return error_response(
        exc.status_code,
        error_code,
        str(exc.detail),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.error(
        f"Unhandled exception: {exc}",
        exc_info=True,
        extra={
            "path": request.url.path,
            "traceback": traceback.format_exc(),
        }
    )
    
    return error_response(
        500,
        "INTERNAL_ERROR",
        "An unexpected error occurred",
    )


def register_error_handlers(app):
    """Register all error handlers with the FastAPI app."""
    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    # Optionally catch all - be careful with this in dev
    # app.add_exception_handler(Exception, generic_exception_handler)
