@echo off
echo ========================================================
echo Starting PerfSight AI (Enterprise Demo)
echo ========================================================

echo [1/3] Starting Backend API...
cd backend
start cmd /k "pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8000"

echo [2/3] Seeding Enterprise Demo Data...
timeout /t 5 >nul
python seed_data.py

echo [3/3] Starting Frontend Dashboard...
cd ../frontend
start cmd /k "npm install && npm run dev"

echo ========================================================
echo PerfSight AI is launching!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo ========================================================
pause
