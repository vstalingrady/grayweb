"""
Text processing and formatting utilities.

Extracted from main.py to improve modularity.
"""
import re
from typing import List

# Pattern to extract URLs from messages (excludes localhost/internal URLs)
URL_EXTRACTION_PATTERN = re.compile(r'https?://[^\s<>"{}|\\^`\[\]\(\)]+')


def extract_urls_from_message(message: str) -> List[str]:
    """Extract URLs from a message for URL context processing.
    
    Returns up to 20 URLs (API limit), filtered to exclude internal/localhost URLs.
    """
    if not message:
        return []
    
    urls = URL_EXTRACTION_PATTERN.findall(message)
    # Filter out internal/localhost URLs
    filtered = [
        url for url in urls 
        if not any(x in url.lower() for x in ['localhost', '127.0.0.1', '0.0.0.0'])
    ]
    # API supports up to 20 URLs per request
    return filtered[:20]


def fallback_title_from_message(message: str) -> str:
    """Generate a fallback title from a message when AI generation fails."""
    trimmed = (message or "").strip()
    if not trimmed:
        return "New Chat"
    if len(trimmed) <= 30:
        return trimmed
    return f"{trimmed[:27].rstrip()}…"


def generate_initials(full_name: str) -> str:
    """Generate initials from full name."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    elif len(parts) == 1:
        return parts[0][:2].upper()
    return "U"
