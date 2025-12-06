"""Audit logging for security-sensitive actions.

Logs important user actions to database for compliance and security monitoring.
"""

import logging
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class AuditAction(str, Enum):
    """Audit action types."""
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_RESET = "password_reset"
    ACCOUNT_DELETE = "account_delete"
    PROFILE_UPDATE = "profile_update"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    API_KEY_CREATED = "api_key_created"
    API_KEY_REVOKED = "api_key_revoked"
    ADMIN_ACTION = "admin_action"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class AuditLogger:
    """Handles audit logging to database and standard logger."""
    
    def __init__(self, database=None):
        self._db = database
        self._table_checked = False
    
    async def _ensure_table(self):
        """Create audit log table if it doesn't exist."""
        if self._table_checked or not self._db:
            return
        
        try:
            await self._db.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    user_id INTEGER,
                    auth_user_id TEXT,
                    action TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    details TEXT,
                    severity TEXT DEFAULT 'info'
                )
            """)
            await self._db.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)
            """)
            await self._db.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)
            """)
            await self._db.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)
            """)
            self._table_checked = True
        except Exception as e:
            logger.error(f"Failed to create audit table: {e}")
    
    async def log(
        self,
        action: AuditAction,
        user_id: Optional[int] = None,
        auth_user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "info"
    ):
        """
        Log an audit event.
        
        Args:
            action: The action being audited
            user_id: Internal user ID (if known)
            auth_user_id: Supabase auth user ID
            ip_address: Client IP address
            user_agent: Client user agent
            details: Additional context as dict
            severity: Log severity (info, warning, error, critical)
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Always log to standard logger
        log_msg = f"AUDIT: {action.value}"
        if user_id:
            log_msg += f" user_id={user_id}"
        if auth_user_id:
            log_msg += f" auth_user_id={auth_user_id}"
        if ip_address:
            log_msg += f" ip={ip_address}"
        if details:
            log_msg += f" details={json.dumps(details)}"
        
        log_level = getattr(logging, severity.upper(), logging.INFO)
        logger.log(log_level, log_msg)
        
        # Log to database if available
        if self._db:
            try:
                await self._ensure_table()
                await self._db.execute(
                    """
                    INSERT INTO audit_logs 
                    (timestamp, user_id, auth_user_id, action, ip_address, user_agent, details, severity)
                    VALUES (:timestamp, :user_id, :auth_user_id, :action, :ip, :ua, :details, :severity)
                    """,
                    {
                        "timestamp": timestamp,
                        "user_id": user_id,
                        "auth_user_id": auth_user_id,
                        "action": action.value,
                        "ip": ip_address,
                        "ua": user_agent,
                        "details": json.dumps(details) if details else None,
                        "severity": severity,
                    }
                )
            except Exception as e:
                logger.error(f"Failed to write audit log to DB: {e}")
    
    async def get_user_logs(
        self,
        user_id: int,
        limit: int = 100,
        action_filter: Optional[AuditAction] = None
    ) -> list:
        """Get audit logs for a specific user."""
        if not self._db:
            return []
        
        await self._ensure_table()
        
        query = "SELECT * FROM audit_logs WHERE user_id = :user_id"
        params: Dict[str, Any] = {"user_id": user_id}
        
        if action_filter:
            query += " AND action = :action"
            params["action"] = action_filter.value
        
        query += " ORDER BY timestamp DESC LIMIT :limit"
        params["limit"] = limit
        
        try:
            rows = await self._db.fetch_all(query, params)
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to fetch audit logs: {e}")
            return []


# Singleton instance (initialized with DB later)
_audit_logger: Optional[AuditLogger] = None


def get_audit_logger() -> AuditLogger:
    """Get the global audit logger instance."""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger


def init_audit_logger(database) -> AuditLogger:
    """Initialize the audit logger with a database connection."""
    global _audit_logger
    _audit_logger = AuditLogger(database)
    return _audit_logger
