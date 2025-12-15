#!/bin/bash

# TeXai - Start Script
# This script starts both the frontend and backend servers

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting TeXai..."

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping TeXai..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start backend
echo "📦 Starting backend server..."
cd "$SCRIPT_DIR/backend"

# Kill any existing process on port 8000
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "   Killing existing process on port 8000..."
    kill -9 $(lsof -ti:8000) 2>/dev/null
    sleep 1
fi

# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "   Using virtual environment"
fi

python3 main.py &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 2

# Start frontend with Electron
echo "⚡ Starting Electron app..."
cd "$SCRIPT_DIR/frontend"
npm run electron:dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ TeXai is running!"
echo "   Backend: http://localhost:8000"
echo "   Frontend: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for processes
wait
