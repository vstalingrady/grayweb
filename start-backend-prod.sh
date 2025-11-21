#!/bin/bash
# Production Backend Startup Script
# Starts the backend using the environment variables from .env (PostgreSQL)

set -e

cd /home/ubuntu/gray

echo "🚀 Starting Gray Backend in Production Mode..."

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found at .venv"
    exit 1
fi

# Kill existing backend processes if any
echo "🔄 Stopping any existing backend processes..."
pkill -f "python3 start.py" || true
pkill -f "uvicorn" || true
sleep 2

# Start the backend
# We do NOT force DATABASE_URL here, so it picks up the value from .env
echo "✅ Starting backend..."
cd backend
nohup ../.venv/bin/python3 start.py > ../backend.log 2>&1 &

echo "🎉 Backend started in background! Logs at backend.log"
