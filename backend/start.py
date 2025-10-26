#!/usr/bin/env python3

import uvicorn
import os
import sys
import databases
import sqlalchemy

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()

    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./users.db")

    # Create database tables if they don't exist
    print("Creating database tables...")
    engine = sqlalchemy.create_engine(DATABASE_URL.replace("sqlite:///", "sqlite:///"))
    metadata = sqlalchemy.MetaData()

    # Define tables
    users = sqlalchemy.Table(
        "users",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("email", sqlalchemy.String, unique=True, index=True),
        sqlalchemy.Column("full_name", sqlalchemy.String),
        sqlalchemy.Column("profile_picture_url", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("role", sqlalchemy.String, default="user"),
        sqlalchemy.Column("initials", sqlalchemy.String),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    chat_sessions = sqlalchemy.Table(
        "chat_sessions",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("title", sqlalchemy.String),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    calendars = sqlalchemy.Table(
        "calendars",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("label", sqlalchemy.String),
        sqlalchemy.Column("color", sqlalchemy.String),
        sqlalchemy.Column("is_visible", sqlalchemy.Boolean, default=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    # Note: calendar_events table removed calendar_id column - it was conflicting with queries
    calendar_events = sqlalchemy.Table(
        "calendar_events",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("calendar_id", sqlalchemy.ForeignKey("calendars.id"), nullable=True),
        sqlalchemy.Column("title", sqlalchemy.String),
        sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("start_time", sqlalchemy.DateTime),
        sqlalchemy.Column("end_time", sqlalchemy.DateTime),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
    )
    plans = sqlalchemy.Table(
        "plans",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("label", sqlalchemy.String),
        sqlalchemy.Column("completed", sqlalchemy.Boolean, default=False),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    # Add habits table
    habits = sqlalchemy.Table(
        "habits",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("label", sqlalchemy.String),
        sqlalchemy.Column("streak_label", sqlalchemy.String),
        sqlalchemy.Column("previous_label", sqlalchemy.String),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    user_streaks = sqlalchemy.Table(
        "user_streaks",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
        sqlalchemy.Column("current_streak", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("last_activity_date", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    # Proactivity tracking
    proactivity_logs = sqlalchemy.Table(
        "proactivity_logs",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("activity_date", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("tasks_completed", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("total_tasks", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("score", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("notes", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    # Fixed: Removed calendar_id reference from CalendarEvent table

    # Google Calendar credentials table
    google_calendar_credentials = sqlalchemy.Table(
        "google_calendar_credentials",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("access_token", sqlalchemy.String),
        sqlalchemy.Column("refresh_token", sqlalchemy.String),
        sqlalchemy.Column("token_uri", sqlalchemy.String),
        sqlalchemy.Column("client_id", sqlalchemy.String),
        sqlalchemy.Column("client_secret", sqlalchemy.String),
        sqlalchemy.Column("scopes", sqlalchemy.String),  # JSON string
        sqlalchemy.Column("expires_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    metadata.create_all(engine)
    print("Database tables created successfully!")

    # Start the FastAPI server
    print("Starting FastAPI server on http://localhost:8000")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
