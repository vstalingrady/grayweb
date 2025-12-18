"""
Security utilities for sanitizing sensitive data in logs and responses.
"""
import re
from typing import Any, Dict, Mapping, Union

# Keys/fields that should always be redacted when present.
SENSITIVE_KEYS = {
    "password",
    "secret",
    "api_key",
    "apikey",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "auth",
    "credential",
    "credentials",
    "private_key",
    "session_id",
    "cookie",
    "csrf_token",
    "client_secret",
    "id_token",
}

# Header-style keys that should be treated as sensitive verbatim.
SENSITIVE_HEADER_KEYS = {
    "authorization",
    "proxy-authorization",
    "x-api-key",
    "x-supabase-key",
    "x-client-secret",
    "cookie",
    "set-cookie",
}


def sanitize_for_logging(data: Union[str, Mapping[str, Any], Any]) -> Union[str, Dict[str, Any], Any]:
    """
    Sanitize sensitive information from data before logging.
    
    Redacts:
    - Authorization tokens (Bearer, JWT, Basic)
    - API keys and secrets
    - Passwords
    - Email addresses (masked)
    - Credit card numbers
    - SSNs
    
    Args:
        data: The data to sanitize (string, mapping, or other)
        
    Returns:
        Sanitized data with sensitive information redacted
    """
    if isinstance(data, bytes):
        try:
            return _sanitize_string(data.decode("utf-8"))
        except UnicodeDecodeError:
            return "[BYTES_REDACTED]"
    if isinstance(data, str):
        return _sanitize_string(data)
    if isinstance(data, Mapping):
        return _sanitize_dict(dict(data))
    if isinstance(data, list):
        return [sanitize_for_logging(item) for item in data]
    return data


def _sanitize_string(text: str) -> str:
    """Sanitize a string value."""
    if not text:
        return text
    
    # Redact Bearer tokens
    text = re.sub(r'Bearer\s+[A-Za-z0-9\-._~+/]+=*', 'Bearer [REDACTED]', text, flags=re.IGNORECASE)

    # Redact Basic auth headers
    text = re.sub(r'Basic\s+[A-Za-z0-9+/=]+', 'Basic [REDACTED]', text, flags=re.IGNORECASE)
    
    # Redact JWT tokens (three base64 segments separated by dots)
    text = re.sub(
        r'eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+',
        '[JWT_REDACTED]',
        text
    )

    # Redact Authorization-like fields in free-form text
    text = re.sub(r'(?i)(authorization[:=]\s*)([^\s;,]+)', r'\1[REDACTED]', text)
    
    # Redact API keys (common patterns)
    text = re.sub(r'(["\']?api[_-]?key["\']?\s*[:=]\s*["\']?)([A-Za-z0-9\-_]{20,})', r'\1[REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'(["\']?secret["\']?\s*[:=]\s*["\']?)([A-Za-z0-9\-_]{20,})', r'\1[REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'(["\']?token["\']?\s*[:=]\s*["\']?)([A-Za-z0-9\-_]{20,})', r'\1[REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'(["\']?client[_-]?secret["\']?\s*[:=]\s*["\']?)([A-Za-z0-9\-_]{8,})', r'\1[REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'(["\']?state["\']?\s*[:=]\s*["\']?)([A-Za-z0-9\-_]{8,})', r'\1[REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'(["\']?code["\']?\s*[:=]\s*["\']?)([A-Za-z0-9\-_]{8,})', r'\1[REDACTED]', text, flags=re.IGNORECASE)
    
    # Redact passwords
    text = re.sub(r'(["\']?password["\']?\s*[:=]\s*["\']?)([^"\'}\s]+)', r'\1[REDACTED]', text, flags=re.IGNORECASE)

    # Redact tokens in query params
    text = re.sub(r'(?i)([?&](?:code|state|token|access_token|refresh_token|id_token)=)([^&\s]+)', r'\1[REDACTED]', text)

    # Redact cookies in header-like strings
    text = re.sub(r'(?i)(cookie[:=]\s*)([^;\s]+)', r'\1[REDACTED]', text)
    
    # Mask email addresses (show first char + domain)
    text = re.sub(
        r'\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b',
        r'\1***@\2',
        text
    )
    
    # Redact credit card numbers
    text = re.sub(r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', '[CC_REDACTED]', text)
    
    # Redact SSNs
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN_REDACTED]', text)
    
    return text


def _sanitize_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize a dictionary recursively."""
    sanitized = {}

    for key, value in data.items():
        lower_key = key.lower()

        # Redact sensitive keys entirely
        if (
            lower_key in SENSITIVE_HEADER_KEYS
            or any(sensitive in lower_key for sensitive in SENSITIVE_KEYS)
        ):
            sanitized[key] = '[REDACTED]'
        elif isinstance(value, str):
            sanitized[key] = _sanitize_string(value)
        elif isinstance(value, dict):
            sanitized[key] = _sanitize_dict(value)
        elif isinstance(value, list):
            sanitized[key] = [sanitize_for_logging(item) for item in value]
        elif isinstance(value, Mapping):
            sanitized[key] = _sanitize_dict(dict(value))
        elif isinstance(value, bytes):
            try:
                sanitized[key] = _sanitize_string(value.decode("utf-8"))
            except Exception:
                sanitized[key] = "[BYTES_REDACTED]"
        else:
            sanitized[key] = value
    
    return sanitized
