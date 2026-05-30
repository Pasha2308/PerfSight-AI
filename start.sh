#!/bin/bash
echo "========================================================"
echo "Starting PerfSight AI (Enterprise Demo)"
echo "========================================================"

echo "[1/3] Starting Backend API..."
cd backend
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "[2/3] Seeding Enterprise Demo Data..."
sleep 5
python seed_data.py

echo "[3/3] Starting Frontend Dashboard..."
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

echo "========================================================"
echo "PerfSight AI is launching!"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:8000"
echo "Press Ctrl+C to stop all services."
echo "========================================================"

# Wait for background processes
wait $BACKEND_PID
wait $FRONTEND_PID
