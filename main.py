import os
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from supabase import Client, create_client

# Load environment variables from .env
load_dotenv()

# Fetch variables
USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
_SUPABASE_CLIENT: Optional[Client] = None


@contextmanager
def get_connection():
    """Yield a psycopg2 connection using the configured environment variables."""
    if not all([USER, PASSWORD, HOST, PORT, DBNAME]):
        missing = [
            name
            for name, value in {
                "user": USER,
                "password": PASSWORD,
                "host": HOST,
                "port": PORT,
                "dbname": DBNAME,
            }.items()
            if not value
        ]
        raise RuntimeError(
            f"Database environment variables missing: {', '.join(missing)}"
        )

    connection = psycopg2.connect(
        user=USER,
        password=PASSWORD,
        host=HOST,
        port=PORT,
        dbname=DBNAME,
    )
    try:
        yield connection
    finally:
        connection.close()


app = FastAPI()


def get_supabase_client() -> Client:
    """Return a cached Supabase client configured from the environment."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        missing = [
            name
            for name, value in {
                "SUPABASE_URL": SUPABASE_URL,
                "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
            }.items()
            if not value
        ]
        raise RuntimeError(
            f"Supabase environment variables missing: {', '.join(missing)}"
        )

    global _SUPABASE_CLIENT
    if _SUPABASE_CLIENT is None:
        _SUPABASE_CLIENT = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    return _SUPABASE_CLIENT


@app.get("/")
def root():
    return JSONResponse({"status": "ok"})


@app.get("/time")
def get_current_time():
    """Return the current database time to verify the connection."""
    try:
        with get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute("SELECT NOW();")
            result = cursor.fetchone()
            cursor.close()
            return {"current_time": result[0].isoformat() if result else None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/supabase/health")
def supabase_health():
    """Verify Supabase configuration is present and the client can be instantiated."""
    try:
        get_supabase_client()
        return {"configured": True, "url": SUPABASE_URL}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/supabase/table/{table_name}")
def supabase_table_preview(table_name: str, limit: int = 5) -> Dict[str, Any]:
    """Preview rows from a Supabase table using the anon key.

    RLS policies must allow anon access for this request to succeed.
    """
    try:
        client = get_supabase_client()
        response = client.table(table_name).select("*").limit(limit).execute()
        if response.error:
            raise HTTPException(status_code=400, detail=response.error.message)

        rows: List[Dict[str, Any]] = (
            response.data if isinstance(response.data, list) else [response.data]
        )
        return {"table": table_name, "limit": limit, "rows": rows}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    # Running "python main.py" will start the FastAPI app with Uvicorn.
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
