from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import databases
import sqlalchemy
from datetime import datetime
import os
import json
import asyncio
from dotenv import load_dotenv
import google.generativeai as genai
from supabase import create_client, Client

load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

# Database tables
users = sqlalchemy.Table(
    "users",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("email", sqlalchemy.String, unique=True, index=True),
    sqlalchemy.Column("full_name", sqlalchemy.String),
    sqlalchemy.Column("profile_picture_url", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String, default="user"),
    sqlalchemy.Column("initials", sqlalchemy.String),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

chat_sessions = sqlalchemy.Table(
    "chat_sessions",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("title", sqlalchemy.String),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

calendars = sqlalchemy.Table(
    "calendars",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("label", sqlalchemy.String),
    sqlalchemy.Column("color", sqlalchemy.String),
    sqlalchemy.Column("is_visible", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

plans = sqlalchemy.Table(
    "plans",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("label", sqlalchemy.String),
    sqlalchemy.Column("completed", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

habits = sqlalchemy.Table(
    "habits",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("label", sqlalchemy.String),
    sqlalchemy.Column("streak_label", sqlalchemy.String),
    sqlalchemy.Column("previous_label", sqlalchemy.String),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

user_streaks = sqlalchemy.Table(
    "user_streaks",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
    sqlalchemy.Column("current_streak", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("last_activity_date", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

# Pydantic models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    profile_picture_url: Optional[str] = None
    role: str = "user"

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: Optional[str] = None

class User(UserBase):
    id: int
    initials: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class ChatSessionBase(BaseModel):
    title: str

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class CalendarBase(BaseModel):
    label: str
    color: str
    is_visible: bool = True

class CalendarCreate(CalendarBase):
    pass

class CalendarUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    is_visible: Optional[bool] = None

class Calendar(CalendarBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class CalendarEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEvent(CalendarEventBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        orm_mode = True

class PlanBase(BaseModel):
    label: str
    completed: bool = False

class PlanCreate(PlanBase):
    pass

class Plan(PlanBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class UserStreakBase(BaseModel):
    current_streak: int = 0
    last_activity_date: Optional[datetime] = None

class UserStreakCreate(UserStreakBase):
    pass

class UserStreak(UserStreakBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class PlanUpdate(BaseModel):
    label: Optional[str] = None
    completed: Optional[bool] = None

class HabitBase(BaseModel):
    label: str
    streak_label: str
    previous_label: str

class HabitCreate(HabitBase):
    pass

class Habit(HabitBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class HabitUpdate(BaseModel):
    label: Optional[str] = None
    streak_label: Optional[str] = None
    previous_label: Optional[str] = None

# AI Chat models
class ChatMessage(BaseModel):
    role: str  # 'user' or 'model'
    text: str

class ChatSessionCreate(BaseModel):
    title: str
    user_id: int

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: int

class ChatResponse(BaseModel):
    response: str
    conversation_id: str

# Gemini AI and Supabase setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Gemini
if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    genai.configure(api_key=GEMINI_API_KEY)
    try:
        # Use gemini-flash-latest for normal use as specified
        gemini_model = genai.GenerativeModel('models/gemini-flash-latest')
        print("Gemini AI initialized successfully with models/gemini-flash-latest")
    except Exception as e:
        print(f"Failed to initialize models/gemini-flash-latest, trying fallback model: {e}")
        try:
            # Use gemini-flash-lite-latest for fallback as specified
            gemini_model = genai.GenerativeModel('models/gemini-flash-lite-latest')
            print("Gemini AI initialized successfully with models/gemini-flash-lite-latest (fallback)")
        except Exception as e2:
            print(f"Failed to initialize fallback model: {e2}")
            gemini_model = None
else:
    gemini_model = None
    print("Warning: GEMINI_API_KEY not configured. AI responses will be simulated.")

# Initialize Supabase
if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client initialized successfully")
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
        print("Conversation history will not be persisted.")
        supabase = None
else:
    supabase = None
    print("Warning: Supabase credentials not configured. Conversation history will not be persisted.")

# FastAPI app
app = FastAPI(title="User Profile API with AI Chat", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Database dependency
async def get_database():
    await database.connect()
    try:
        yield database
    finally:
        await database.disconnect()

# Helper functions
def generate_initials(full_name: str) -> str:
    """Generate initials from full name."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    elif len(parts) == 1:
        return parts[0][:2].upper()
    return "U"

# Streak helper functions
async def get_or_create_user_streak(user_id: int, db: databases.Database) -> UserStreak:
    """Get existing user streak or create new one"""
    query = user_streaks.select().where(user_streaks.c.user_id == user_id)
    streak = await db.fetch_one(query)
    if not streak:
        # Create new streak record with explicit timestamps
        from datetime import datetime
        now = datetime.utcnow()
        create_query = user_streaks.insert().values(
            user_id=user_id,
            current_streak=0,
            last_activity_date=None,
            created_at=now,
            updated_at=now
        )
        streak_id = await db.execute(create_query)
        select_query = user_streaks.select().where(user_streaks.c.id == streak_id)
        streak = await db.fetch_one(select_query)
    return streak

async def update_user_streak(user_id: int, db: databases.Database):
    """Update user streak based on daily activity"""
    from datetime import datetime, date

    today = datetime.utcnow().date()
    streak = await get_or_create_user_streak(user_id, db)

    # Check if last activity was yesterday
    if streak['last_activity_date']:
        last_activity = streak['last_activity_date'].date()
        yesterday = date.fromordinal(today.toordinal() - 1)

        if last_activity == yesterday:
            # Continue streak
            new_streak = streak['current_streak'] + 1
        elif last_activity < yesterday:
            # Streak broken, start new one
            new_streak = 1
        else:
            # Already updated today
            return streak
    else:
        # First activity ever
        new_streak = 1

    # Update streak record
    update_query = user_streaks.update().where(
        user_streaks.c.user_id == user_id
    ).values(
        current_streak=new_streak,
        last_activity_date=datetime.utcnow()
    )
    await db.execute(update_query)

    # Return updated streak
    select_query = user_streaks.select().where(user_streaks.c.user_id == user_id)
    updated_streak = await db.fetch_one(select_query)
    return updated_streak

# API Routes

@app.get("/")
async def root():
    return {"message": "User Profile API with AI Chat"}

# AI Chat helper functions
async def get_or_create_conversation(conversation_id: Optional[str], user_id: int) -> str:
    """Get existing conversation or create new one"""
    if conversation_id and supabase:
        try:
            # Check if conversation exists
            result = supabase.table("conversations").select("id, history").eq("id", conversation_id).execute()
            if result.data:
                return conversation_id
        except Exception as e:
            print(f"Error checking conversation: {e}")

    # Create new conversation
    if supabase:
        try:
            result = supabase.table("conversations").insert({
                "title": "New Conversation",
                "history": []
            }).execute()
            if result.data:
                return result.data[0]["id"]
        except Exception as e:
            print(f"Error creating conversation: {e}")

    # Fallback: return a mock ID
    import uuid
    return str(uuid.uuid4())

async def save_conversation_message(conversation_id: str, message: Dict[str, str]):
    """Save message to conversation history"""
    if not supabase:
        return

    try:
        # Get current history
        result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
        if result.data:
            history = result.data[0]["history"] or []
            history.append(message)

            # Update conversation
            supabase.table("conversations").update({
                "history": history
            }).eq("id", conversation_id).execute()
    except Exception as e:
        print(f"Error saving message: {e}")

async def generate_ai_response(message: str, conversation_history: List[Dict[str, str]] = None) -> str:
    """Generate AI response using Gemini or fallback"""
    if gemini_model:
        try:
            # Build conversation context
            context = ""
            if conversation_history:
                for msg in conversation_history[-10:]:  # Last 10 messages for context
                    context += f"{msg['role']}: {msg['text']}\n"

            # Generate response
            full_prompt = f"{context}\nuser: {message}\nmodel:"
            response = gemini_model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            print(f"Gemini API error: {e}")

    # Fallback response
    responses = [
        "That's an interesting point! Could you tell me more about what you're thinking?",
        "I appreciate you sharing that. Let me think about how I can best help you.",
        "Thanks for your message! What would you like to explore further?",
        "I understand. How can I assist you with this topic?",
        "That's a great question! Here's what comes to mind..."
    ]
    import random
    return random.choice(responses)

# AI Chat endpoints
@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """Send a message to AI and get a response"""
    try:
        # Get or create conversation
        conversation_id = await get_or_create_conversation(request.conversation_id, request.user_id)

        # Save user message
        await save_conversation_message(conversation_id, {
            "role": "user",
            "text": request.message
        })

        # Get conversation history for context
        conversation_history = []
        if supabase and conversation_id:
            try:
                result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
                if result.data:
                    conversation_history = result.data[0]["history"] or []
            except Exception as e:
                print(f"Error getting conversation history: {e}")

        # Generate AI response
        ai_response = await generate_ai_response(request.message, conversation_history)

        # Save AI response
        await save_conversation_message(conversation_id, {
            "role": "model",
            "text": ai_response
        })

        # Update user streak for daily activity
        await update_user_streak(request.user_id, db)

        return ChatResponse(response=ai_response, conversation_id=conversation_id)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@app.get("/api/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation history"""
    try:
        if not supabase:
            return []

        result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
        if result.data:
            return result.data[0]["history"] or []
        return []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(e)}")

@app.post("/api/conversation")
async def create_conversation(request: ChatSessionCreate):
    """Create a new conversation"""
    try:
        if not supabase:
            # Fallback: return mock conversation
            import uuid
            return {"id": str(uuid.uuid4()), "title": request.title, "history": []}

        result = supabase.table("conversations").insert({
            "title": request.title,
            "history": []
        }).execute()

        if result.data:
            return result.data[0]
        else:
            raise HTTPException(status_code=500, detail="Failed to create conversation")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating conversation: {str(e)}")

# User endpoints
@app.post("/users/", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: databases.Database = Depends(get_database)):
    initials = generate_initials(user.full_name)
    now = datetime.utcnow()
    query = users.insert().values(
        email=user.email,
        full_name=user.full_name,
        profile_picture_url=user.profile_picture_url,
        role=user.role,
        initials=initials,
        created_at=now,
        updated_at=now
    )
    user_id = await db.execute(query)

    # Seed default calendars
    default_calendars = [
        {
            "label": "Operations",
            "color": "linear-gradient(135deg, #5b8def, #304ffe)",
            "is_visible": True,
        },
        {
            "label": "Team",
            "color": "linear-gradient(135deg, #ff7d9d, #ff14c6)",
            "is_visible": True,
        },
        {
            "label": "Personal",
            "color": "linear-gradient(135deg, #20d39c, #0c9f6f)",
            "is_visible": True,
        },
    ]

    calendar_ids: Dict[str, int] = {}
    for calendar in default_calendars:
        calendar_id = await db.execute(
            calendars.insert().values(
                user_id=user_id,
                label=calendar["label"],
                color=calendar["color"],
                is_visible=calendar["is_visible"],
                created_at=now,
                updated_at=now,
            )
        )
        calendar_ids[calendar["label"]] = calendar_id

    # Seed default calendar events
    default_events = [
        {
            "title": "Builder cohort sync",
            "calendar_label": "Operations",
            "start": "2025-10-25T08:30:00",
            "end": "2025-10-25T09:15:00",
        },
        {
            "title": "Proactivity instrumentation review",
            "calendar_label": "Operations",
            "start": "2025-10-25T11:00:00",
            "end": "2025-10-25T12:00:00",
        },
        {
            "title": "Pulse QA slot",
            "calendar_label": "Operations",
            "start": "2025-10-25T15:30:00",
            "end": "2025-10-25T16:00:00",
        },
        {
            "title": "Alignment recap + journaling",
            "calendar_label": "Operations",
            "start": "2025-10-25T19:00:00",
            "end": "2025-10-25T19:45:00",
        },
        {
            "title": "Design review",
            "calendar_label": "Team",
            "start": "2025-10-24T11:00:00",
            "end": "2025-10-24T12:00:00",
        },
        {
            "title": "Run club",
            "calendar_label": "Personal",
            "start": "2025-10-23T07:30:00",
            "end": "2025-10-23T08:15:00",
        },
    ]

    for event in default_events:
        calendar_id = calendar_ids.get(event["calendar_label"])
        if calendar_id is None:
            continue
        try:
            start_time = datetime.fromisoformat(event["start"])
            end_time = datetime.fromisoformat(event["end"])
        except ValueError:
            # Skip invalid event definitions rather than breaking user creation
            continue

        await db.execute(
            calendar_events.insert().values(
                user_id=user_id,
                calendar_id=calendar_id,
                title=event["title"],
                description=None,
                start_time=start_time,
                end_time=end_time,
                created_at=now,
            )
        )

    # Seed default plans
    default_plans = [
        {
            "label": "Restore proactive cadence for the builder cohort.",
            "completed": False,
        },
        {
            "label": "Draft mitigation follow-up checklist.",
            "completed": False,
        },
        {
            "label": "Lock launch checklist scope for the revamp.",
            "completed": True,
        },
        {
            "label": "Draft async sync for builder cohort.",
            "completed": False,
        },
    ]

    for plan in default_plans:
        await db.execute(
            plans.insert().values(
                user_id=user_id,
                label=plan["label"],
                completed=plan["completed"],
                created_at=now,
                updated_at=now,
            )
        )

    # Seed default habits
    default_habits = [
        {
            "label": "Coaching loop deferred until services stabilize.",
            "streak_label": "4 days",
            "previous_label": "Prev: Yesterday — 3 days",
        },
        {
            "label": "No YouTube.",
            "streak_label": "6 days",
            "previous_label": "Prev: Yesterday — 5 days",
        },
        {
            "label": "Movement break.",
            "streak_label": "2 days",
            "previous_label": "Prev: Yesterday — 1 day",
        },
    ]

    for habit in default_habits:
        await db.execute(
            habits.insert().values(
                user_id=user_id,
                label=habit["label"],
                streak_label=habit["streak_label"],
                previous_label=habit["previous_label"],
                created_at=now,
                updated_at=now,
            )
        )

    return {
        **user.dict(),
        "id": user_id,
        "initials": initials,
        "created_at": now,
        "updated_at": now
    }

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int, db: databases.Database = Depends(get_database)):
    query = users.select().where(users.c.id == user_id)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users/email/{email}", response_model=User)
async def get_user_by_email(email: str, db: databases.Database = Depends(get_database)):
    query = users.select().where(users.c.email == email)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/users/{user_id}", response_model=User)
async def update_user(user_id: int, user_update: UserUpdate, db: databases.Database = Depends(get_database)):
    # Get current user
    query = users.select().where(users.c.id == user_id)
    current_user = await db.fetch_one(query)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    update_data = user_update.dict(exclude_unset=True)
    if "full_name" in update_data:
        update_data["initials"] = generate_initials(update_data["full_name"])

    update_data["updated_at"] = datetime.utcnow()

    query = users.update().where(users.c.id == user_id).values(**update_data)
    await db.execute(query)

    # Return updated user
    query = users.select().where(users.c.id == user_id)
    return await db.fetch_one(query)

@app.get("/users/{user_id}/chat-sessions", response_model=List[ChatSession])
async def get_user_chat_sessions(user_id: int, db: databases.Database = Depends(get_database)):
    query = chat_sessions.select().where(chat_sessions.c.user_id == user_id).order_by(chat_sessions.c.updated_at.desc())
    return await db.fetch_all(query)

@app.post("/users/{user_id}/chat-sessions", response_model=ChatSession, status_code=status.HTTP_201_CREATED)
async def create_chat_session(user_id: int, session: ChatSessionCreate, db: databases.Database = Depends(get_database)):
    query = chat_sessions.insert().values(
        user_id=user_id,
        title=session.title
    )
    session_id = await db.execute(query)
    return {**session.dict(), "id": session_id, "user_id": user_id}

@app.get("/users/{user_id}/calendars", response_model=List[Calendar])
async def get_user_calendars(user_id: int, db: databases.Database = Depends(get_database)):
    query = calendars.select().where(calendars.c.user_id == user_id).order_by(calendars.c.created_at)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/calendars", response_model=Calendar, status_code=status.HTTP_201_CREATED)
async def create_calendar(user_id: int, calendar: CalendarCreate, db: databases.Database = Depends(get_database)):
    now = datetime.utcnow()
    calendar_id = await db.execute(
        calendars.insert().values(
            user_id=user_id,
            label=calendar.label,
            color=calendar.color,
            is_visible=calendar.is_visible,
            created_at=now,
            updated_at=now,
        )
    )
    query = calendars.select().where(calendars.c.id == calendar_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/calendars/{calendar_id}", response_model=Calendar)
async def update_calendar(user_id: int, calendar_id: int, calendar_update: CalendarUpdate, db: databases.Database = Depends(get_database)):
    existing = await db.fetch_one(
        calendars.select().where(
            (calendars.c.id == calendar_id) & (calendars.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Calendar not found")

    update_data = calendar_update.dict(exclude_unset=True)
    if not update_data:
        return existing

    update_data["updated_at"] = datetime.utcnow()

    await db.execute(
        calendars.update()
        .where((calendars.c.id == calendar_id) & (calendars.c.user_id == user_id))
        .values(**update_data)
    )
    query = calendars.select().where(calendars.c.id == calendar_id)
    return await db.fetch_one(query)

@app.get("/users/{user_id}/plans", response_model=List[Plan])
async def get_user_plans(user_id: int, db: databases.Database = Depends(get_database)):
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/plans", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(user_id: int, plan: PlanCreate, db: databases.Database = Depends(get_database)):
    now = datetime.utcnow()
    plan_id = await db.execute(
        plans.insert().values(
            user_id=user_id,
            label=plan.label,
            completed=plan.completed,
            created_at=now,
            updated_at=now,
        )
    )
    query = plans.select().where(plans.c.id == plan_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/plans/{plan_id}", response_model=Plan)
async def update_plan(user_id: int, plan_id: int, plan_update: PlanUpdate, db: databases.Database = Depends(get_database)):
    existing = await db.fetch_one(
        plans.select().where(
            (plans.c.id == plan_id) & (plans.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = plan_update.dict(exclude_unset=True)
    if not update_data:
        return existing

    update_data["updated_at"] = datetime.utcnow()

    await db.execute(
        plans.update()
        .where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
        .values(**update_data)
    )
    query = plans.select().where(plans.c.id == plan_id)
    return await db.fetch_one(query)

@app.get("/users/{user_id}/habits", response_model=List[Habit])
async def get_user_habits(user_id: int, db: databases.Database = Depends(get_database)):
    query = habits.select().where(habits.c.user_id == user_id).order_by(habits.c.created_at)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/habits", response_model=Habit, status_code=status.HTTP_201_CREATED)
async def create_habit(user_id: int, habit: HabitCreate, db: databases.Database = Depends(get_database)):
    now = datetime.utcnow()
    habit_id = await db.execute(
        habits.insert().values(
            user_id=user_id,
            label=habit.label,
            streak_label=habit.streak_label,
            previous_label=habit.previous_label,
            created_at=now,
            updated_at=now,
        )
    )
    query = habits.select().where(habits.c.id == habit_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/habits/{habit_id}", response_model=Habit)
async def update_habit(user_id: int, habit_id: int, habit_update: HabitUpdate, db: databases.Database = Depends(get_database)):
    existing = await db.fetch_one(
        habits.select().where(
            (habits.c.id == habit_id) & (habits.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Habit not found")

    update_data = habit_update.dict(exclude_unset=True)
    if not update_data:
        return existing

    update_data["updated_at"] = datetime.utcnow()

    await db.execute(
        habits.update()
        .where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
        .values(**update_data)
    )
    query = habits.select().where(habits.c.id == habit_id)
    return await db.fetch_one(query)

@app.get("/users/{user_id}/streak", response_model=UserStreak)
async def get_user_streak(user_id: int, db: databases.Database = Depends(get_database)):
    streak = await get_or_create_user_streak(user_id, db)
    return streak

@app.post("/users/{user_id}/streak", response_model=UserStreak)
async def touch_user_streak(user_id: int, db: databases.Database = Depends(get_database)):
    return await update_user_streak(user_id, db)

@app.get("/users/{user_id}/calendar-events", response_model=List[CalendarEvent])
async def get_user_calendar_events(user_id: int, db: databases.Database = Depends(get_database)):
    # Fixed query to avoid calendar_id column references
    query = calendar_events.select().where(calendar_events.c.user_id == user_id).order_by(calendar_events.c.start_time)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/calendar-events", response_model=CalendarEvent, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(user_id: int, event: CalendarEventCreate, db: databases.Database = Depends(get_database)):
    query = calendar_events.insert().values(
        user_id=user_id,
        calendar_id=event.calendar_id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time
    )
    event_id = await db.execute(query)
    return {**event.dict(), "id": event_id, "user_id": user_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
