"""
Enhanced logging configuration for the backend application.

This module provides detailed, structured logging with:
- Multiple log levels and formatters
- File and console handlers
- Request/response logging middleware
- Performance monitoring
- Error tracking and correlation IDs
- Environment-specific configurations
"""

import os
import sys
import json
import logging
import logging.handlers
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from contextvars import ContextVar

try:
    from backend.security_utils import sanitize_for_logging
except ImportError:
    from security_utils import sanitize_for_logging

# Context variables for request tracing
request_id: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
user_id: ContextVar[Optional[str]] = ContextVar('user_id', default=None)

_LOG_RECORD_RESERVED_FIELDS = {
    'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
    'filename', 'module', 'lineno', 'funcName', 'created',
    'msecs', 'relativeCreated', 'thread', 'threadName',
    'processName', 'process', 'getMessage', 'exc_info',
    'exc_text', 'stack_info', 'message'
}


def _sanitize_record_extras(record: logging.LogRecord) -> Dict[str, Any]:
    """Extract and sanitize non-standard log record fields."""
    sanitized: Dict[str, Any] = {}
    for key, value in record.__dict__.items():
        if key in _LOG_RECORD_RESERVED_FIELDS:
            continue
        sanitized[key] = sanitize_for_logging(value)
    return sanitized


def _sanitize_extra_dict(extra: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize a plain dictionary for logging."""
    return {key: sanitize_for_logging(value) for key, value in extra.items()}


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs structured JSON logs."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        message = sanitize_for_logging(record.getMessage())
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': message,
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # Add context information if available
        if request_id.get():
            log_data['request_id'] = request_id.get()
        if user_id.get():
            log_data['user_id'] = user_id.get()

        # Add exception information if present
        if record.exc_info:
            log_data['exception'] = sanitize_for_logging(self.formatException(record.exc_info))

        # Add extra fields from the record
        for key, value in _sanitize_record_extras(record).items():
            if key not in log_data:
                log_data[key] = value

        return json.dumps(log_data, default=str)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for console output during development."""

    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }

    def format(self, record: logging.LogRecord) -> str:
        """Format log record with colors - simplified for readability."""
        color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        reset = self.COLORS['RESET']

        # Simplified timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        sanitized_message = sanitize_for_logging(record.getMessage())

        # Simple format: [time] LEVEL: message
        formatted = f"{color}[{timestamp}] {record.levelname}: {sanitized_message}{reset}"

        if record.exc_info:
            formatted += f"\n{sanitize_for_logging(self.formatException(record.exc_info))}"

        return formatted


class RequestLoggingMiddleware:
    """Middleware to add request/response logging with correlation IDs."""

    def __init__(self, app, logger: logging.Logger):
        self.app = app
        self.logger = logger

    async def __call__(self, scope, receive, send):
        """ASGI callable with request logging."""
        if scope["type"] == "http":
            await self._log_http_request(scope, receive, send)
        else:
            await self.app(scope, receive, send)

    async def _log_http_request(self, scope, receive, send):
        """Log HTTP requests and responses - simplified."""
        # Generate correlation ID
        correlation_id = str(uuid.uuid4())
        request_id.set(correlation_id)

        # Extract request information
        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "UNKNOWN")

        # Skip noisy polling/health endpoints entirely
        skip_logging = (
            path in ("/health", "/health/ready", "/health/live", "/favicon.ico")
            or (method == "GET" and path.endswith("/reminders") and "/users/" in path)
            or path.startswith("/static/")
        )

        start_time = datetime.utcnow()

        # Track response status
        response_status = [0]  # Use list for closure modification

        async def wrapped_send(message):
            if message["type"] == "http.response.start":
                response_status[0] = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, wrapped_send)
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            self.logger.error(f"{method} {path} -> ERROR ({duration*1000:.0f}ms): {str(e)}")
            raise
        finally:
            if not skip_logging:
                duration = (datetime.utcnow() - start_time).total_seconds()
                status = response_status[0]
                duration_str = f"{duration*1000:.0f}ms"
                
                # Only log non-success statuses or slow requests (>500ms)
                if status >= 400:
                    if status >= 500:
                        self.logger.error(f"{method} {path} -> {status} ({duration_str})")
                    else:
                        self.logger.warning(f"{method} {path} -> {status} ({duration_str})")
                elif duration > 0.5:
                    # Log slow requests
                    self.logger.info(f"{method} {path} -> {status} ({duration_str}) [slow]")



def get_log_level() -> int:
    """Get appropriate log level based on environment."""
    env_log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    return getattr(logging, env_log_level, logging.INFO)


def setup_logging(
    log_level: Optional[int] = None,
    log_file: Optional[str] = None,
    enable_console: bool = True,
    enable_file: bool = True,
    structured_format: bool = False
) -> logging.Logger:
    """
    Set up comprehensive logging configuration.

    Args:
        log_level: Logging level (defaults to environment LOG_LEVEL or INFO)
        log_file: Path to log file (defaults to logs/app.log)
        enable_console: Enable console logging
        enable_file: Enable file logging
        structured_format: Use JSON structured logging format

    Returns:
        Configured logger instance
    """

    if log_level is None:
        log_level = get_log_level()

    # Create logs directory if needed
    if log_file is None and enable_file:
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / "app.log"

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers
    root_logger.handlers.clear()

    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)

        if structured_format or os.getenv("ENVIRONMENT") == "production":
            console_formatter = StructuredFormatter()
        else:
            console_formatter = ColoredFormatter()

        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)

    # File handler with rotation
    if enable_file and log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=50 * 1024 * 1024,  # 50MB
            backupCount=10,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)  # Always log DEBUG to file
        file_formatter = StructuredFormatter()
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)

        # Also create an error-only file
        error_file = Path(log_file).parent / "error.log"
        error_handler = logging.handlers.RotatingFileHandler(
            error_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        root_logger.addHandler(error_handler)

    # Configure specific loggers
    _configure_specific_loggers()

    return logging.getLogger(__name__)


def _configure_specific_loggers():
    """Configure logging for specific third-party libraries."""

    # Disable noisy loggers
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpcore.http2").setLevel(logging.WARNING)
    logging.getLogger("urllib3.connectionpool").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("databases").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    logging.getLogger("apscheduler.scheduler").setLevel(logging.WARNING)
    logging.getLogger("google_genai").setLevel(logging.WARNING)

    # Enable detailed logging for our application
    logging.getLogger("backend").setLevel(logging.DEBUG)


def create_logger(name: str) -> logging.Logger:
    """Create a logger with the specified name."""
    return logging.getLogger(name)


def set_request_context(req_id: str, usr_id: Optional[str] = None):
    """Set request context for logging."""
    request_id.set(req_id)
    if usr_id:
        user_id.set(usr_id)


def clear_request_context():
    """Clear request context."""
    request_id.set(None)
    user_id.set(None)


# Performance monitoring decorator
def log_performance(logger: logging.Logger):
    """Decorator to log function performance."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            try:
                result = func(*args, **kwargs)
                duration = (datetime.utcnow() - start_time).total_seconds()

                logger.debug(
                    f"Function {func.__name__} completed successfully",
                    extra={
                        "event_type": "function_performance",
                        "function": func.__name__,
                        "duration_ms": duration * 1000,
                        "success": True
                    }
                )
                return result
            except Exception as e:
                duration = (datetime.utcnow() - start_time).total_seconds()

                logger.error(
                    f"Function {func.__name__} failed: {str(e)}",
                    extra={
                        "event_type": "function_performance",
                        "function": func.__name__,
                        "duration_ms": duration * 1000,
                        "success": False,
                        "error": str(e)
                    }
                )
                raise
        return wrapper
    return decorator


# Database query logging
def log_database_query(
    logger: logging.Logger,
    query: str,
    params: Optional[Dict[str, Any]] = None,
    duration_ms: Optional[float] = None,
    success: bool = True,
    error: Optional[str] = None
):
    """Log database query information."""
    sanitized_query = str(sanitize_for_logging(query or ""))
    query_preview = sanitized_query[:100] + ("..." if len(sanitized_query) > 100 else "")
    sanitized_params = sanitize_for_logging(params) if params is not None else None
    logger.debug(
        f"Database query executed: {query_preview}",
        extra={
            "event_type": "database_query",
            "query": sanitized_query,
            "params": sanitized_params,
            "duration_ms": duration_ms,
            "success": success,
            "error": sanitize_for_logging(error) if error else None
        }
    )


# API call logging
def log_api_call(
    logger: logging.Logger,
    service: str,
    method: str,
    url: str,
    status_code: Optional[int] = None,
    duration_ms: Optional[float] = None,
    success: bool = True,
    error: Optional[str] = None
):
    """Log external API call information."""
    sanitized_url = sanitize_for_logging(url)
    logger.info(
        f"API call to {service}: {method} {sanitized_url}",
        extra={
            "event_type": "api_call",
            "service": service,
            "method": method,
            "url": sanitized_url,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "success": success,
            "error": sanitize_for_logging(error) if error else None
        }
    )
