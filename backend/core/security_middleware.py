"""
Security middleware and CSP configuration.

Extracted from main.py to improve modularity.
"""

from fastapi import Request
from fastapi.responses import Response


CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://apis.google.com https://accounts.google.com",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
]


async def add_security_headers(request: Request, call_next) -> Response:
    """
    Middleware to add security headers to all responses.
    
    Includes HSTS, X-Frame-Options, CSP, and other security headers.
    """
    response = await call_next(request)
    
    # Strict-Transport-Security (HSTS) - Force HTTPS for 1 year
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # X-Frame-Options - Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # X-Content-Type-Options - Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # X-XSS-Protection - Enable browser XSS filter
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Referrer-Policy - Control referrer information
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions-Policy - Restrict browser features
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # Content-Security-Policy (CSP) - Prevent XSS and injection attacks
    response.headers["Content-Security-Policy"] = "; ".join(CSP_DIRECTIVES)
    
    return response
