"""
Dual Database Configuration
============================
Remote DB (Supabase): Auth, users, sessions (cold backup, critical data)
Local DB (SQLite): Chat messages, user data, app state (fast, local)
"""

import os
import asyncio
from typing import Optional, Literal
import databases
import sqlalchemy
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

DatabaseType = Literal["remote", "local"]


class DualDatabaseConfig:
    """Manages connections to both remote (auth) and local (data) databases."""
    
    def __init__(self):
        # Remote database for auth/users (Supabase PostgreSQL)
        self.remote_url = os.getenv("REMOTE_DATABASE_URL")
        if not self.remote_url:
            # Fallback: construct from Supabase credentials
            supabase_url = os.getenv("SUPABASE_URL", "")
            if supabase_url:
                # Extract project ref from URL: https://xxxxx.supabase.co
                project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
                db_password = os.getenv("SUPABASE_DB_PASSWORD", "")
                if db_password:
                    # Use direct connection (not pooler) for migrations
                    self.remote_url = f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
        
        # Local database for user data (SQLite)
        self.local_url = os.getenv("LOCAL_DATABASE_URL", "sqlite:///./backend/users.db")
        
        # Create database connections
        self.remote_db: Optional[databases.Database] = None
        self.local_db: Optional[databases.Database] = None
        
        if self.remote_url:
            self.remote_db = databases.Database(self.remote_url, statement_cache_size=0)
        
        self.local_db = databases.Database(self.local_url, statement_cache_size=0)
        
        # Create metadata for each database
        self.remote_metadata = sqlalchemy.MetaData()
        self.local_metadata = sqlalchemy.MetaData()
    
    async def connect(self):
        """Connect to both databases."""
        if self.remote_db:
            try:
                # Set a short timeout (3s) for remote connection to avoid hanging
                await asyncio.wait_for(self.remote_db.connect(), timeout=3.0)
            except Exception as e:
                print(f"⚠️  Remote database connection failed: {e}")
                print("⚠️  Falling back to local database for all operations")
                self.remote_db = None
        
        await self.local_db.connect()
    
    async def disconnect(self):
        """Disconnect from both databases."""
        if self.remote_db:
            await self.remote_db.disconnect()
        await self.local_db.disconnect()
    
    def get_db(self, db_type: DatabaseType) -> databases.Database:
        """Get the appropriate database connection."""
        if db_type == "remote":
            if not self.remote_db:
                # Fallback to local DB if remote is not configured or failed to connect
                return self.local_db
            return self.remote_db
        return self.local_db
    
    def get_metadata(self, db_type: DatabaseType) -> sqlalchemy.MetaData:
        """Get the appropriate metadata object."""
        if db_type == "remote":
            return self.remote_metadata
        return self.local_metadata


# Global instance
db_config = DualDatabaseConfig()


# Define which tables go where
REMOTE_TABLES = {
    "users",
    "user_streaks", 
    "proactivity_push_subscriptions",
    "google_calendar_credentials",
}

LOCAL_TABLES = {
    "chat_sessions",
    "general_chat_messages",
    "calendars",
    "calendar_events",
    "plans",
    "habits",
    "reminders",
    "dashboard_pulses",
    "proactivity_settings",
    "proactivity_logs",
    "file_search_stores",
    "media_uploads",
    "context_cache",
    "proactive_notifications",
}


def get_table_database(table_name: str) -> DatabaseType:
    """Determine which database a table belongs to."""
    if table_name in REMOTE_TABLES:
        return "remote"
    elif table_name in LOCAL_TABLES:
        return "local"
    else:
        # Default to local for new tables
        return "local"


def get_db_for_table(table_name: str) -> databases.Database:
    """Get the database connection for a specific table."""
    db_type = get_table_database(table_name)
    return db_config.get_db(db_type)


def get_metadata_for_table(table_name: str) -> sqlalchemy.MetaData:
    """Get the metadata object for a specific table."""
    db_type = get_table_database(table_name)
    return db_config.get_metadata(db_type)
