import os
from contextlib import contextmanager

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

# Load environment variables from .env
load_dotenv()

# Fetch variables
USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")


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


if __name__ == "__main__":
    # Running "python main.py" will start the FastAPI app with Uvicorn.
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
