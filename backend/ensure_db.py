#!/usr/bin/env python3
"""Script to ensure database tables exist before starting the server"""

import os
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
print(f"Creating database tables for: {DATABASE_URL}")

import sqlalchemy
from sqlalchemy import text

# Create engine with the same configuration as in start.py
engine = sqlalchemy.create_engine(DATABASE_URL.replace("sqlite:///", "sqlite:///"))
metadata = sqlalchemy.MetaData()

# Define tables exactly as in start.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy import func

users = sqlalchemy.Table(
    "users",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("email", sqlalchemy.String, unique=True, index=True),
    Column("full_name", sqlalchemy.String),
    Column("profile_picture_url", sqlalchemy.String, nullable=True),
    Column("role", sqlalchemy.String, default="user"),
    Column("initials", sqlalchemy.String),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

chat_sessions = sqlalchemy.Table(
    "chat_sessions",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id")),
    Column("title", sqlalchemy.String),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

calendars = sqlalchemy.Table(
    "calendars",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id")),
    Column("label", sqlalchemy.String),
    Column("color", sqlalchemy.String),
    Column("is_visible", sqlalchemy.Boolean, default=True),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

calendar_events = sqlalchemy.Table(
    "calendar_events",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id")),
    Column("calendar_id", ForeignKey("calendars.id"), nullable=True),
    Column("title", sqlalchemy.String),
    Column("description", sqlalchemy.String, nullable=True),
    Column("start_time", sqlalchemy.DateTime),
    Column("end_time", sqlalchemy.DateTime),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
)

plans = sqlalchemy.Table(
    "plans",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id")),
    Column("label", sqlalchemy.String),
    Column("completed", sqlalchemy.Boolean, default=False),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

habits = sqlalchemy.Table(
    "habits",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id")),
    Column("label", sqlalchemy.String),
    Column("streak_label", sqlalchemy.String),
    Column("previous_label", sqlalchemy.String),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

user_streaks = sqlalchemy.Table(
    "user_streaks",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id"), unique=True),
    Column("current_streak", sqlalchemy.Integer, default=0),
    Column("last_activity_date", sqlalchemy.DateTime, nullable=True),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

proactivity_logs = sqlalchemy.Table(
    "proactivity_logs",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id")),
    Column("activity_date", sqlalchemy.DateTime, default=func.now()),
    Column("tasks_completed", sqlalchemy.Integer, default=0),
    Column("total_tasks", sqlalchemy.Integer, default=0),
    Column("score", sqlalchemy.Integer, default=0),
    Column("notes", sqlalchemy.String, nullable=True),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

google_calendar_credentials = sqlalchemy.Table(
    "google_calendar_credentials",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("user_id", ForeignKey("users.id")),
    Column("access_token", sqlalchemy.String),
    Column("refresh_token", sqlalchemy.String),
    Column("token_uri", sqlalchemy.String),
    Column("client_id", sqlalchemy.String),
    Column("client_secret", sqlalchemy.String),
    Column("scopes", sqlalchemy.String),
    Column("expires_at", sqlalchemy.DateTime, nullable=True),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
    Column("updated_at", sqlalchemy.DateTime, default=func.now(), onupdate=func.now()),
)

google_calendar_states = sqlalchemy.Table(
    "google_calendar_states",
    metadata,
    Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    Column("state_token", sqlalchemy.String, unique=True, nullable=False),
    Column("user_id", ForeignKey("users.id")),
    Column("nonce", sqlalchemy.String, nullable=False),
    Column("redirect_uri", sqlalchemy.String, nullable=False),
    Column("expires_at", sqlalchemy.DateTime, nullable=True),
    Column("consumed_at", sqlalchemy.DateTime, nullable=True),
    Column("created_at", sqlalchemy.DateTime, default=func.now()),
)

# Create all tables if they don't exist
metadata.create_all(engine)
print("Database tables created successfully!")

# Now start the main server
import subprocess
import sys
print("Starting the FastAPI server...")
result = subprocess.run([sys.executable, "start.py"], cwd=os.getcwd())
