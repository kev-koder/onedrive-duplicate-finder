@echo off
echo Starting Media Manager...
echo.

:: Start backend in a new window
start "Media Manager - Backend" cmd /k "cd /d %~dp0backend && python main.py"

:: Give the backend a moment to start
timeout /t 2 /nobreak > nul

:: Start frontend in a new window
start "Media Manager - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Give the frontend a moment to start
timeout /t 3 /nobreak > nul

:: Open the browser
start http://localhost:5173

echo Both servers are starting in separate windows.
echo You can minimize those windows but don't close them.
echo.
pause
