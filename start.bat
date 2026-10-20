@echo off
echo ===================================================
echo   Starting TerraShield AI (Backend + Frontend)
echo ===================================================

echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "TerraShield Backend (FastAPI)" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul

echo Starting Vite Frontend on http://localhost:5173 ...
start "TerraShield Frontend (Vite)" cmd /k "cd frontend && npm run dev"

echo ===================================================
echo TerraShield AI is running!
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:8000
echo Docs:     http://127.0.0.1:8000/docs
echo ===================================================
