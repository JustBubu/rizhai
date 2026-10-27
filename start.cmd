@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node 20+ from https://nodejs.org/ then run this again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

REM Already running? Just open the app.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:43123/' -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } } catch { exit 1 }"
if not errorlevel 1 (
  echo Rizhai is already running at http://127.0.0.1:43123
  start "" "http://127.0.0.1:43123"
  exit /b 0
)

echo Starting Rizhai...
REM Open the browser only after the server answers.
start "Rizhai wait" /min cmd /c "powershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0scripts\wait-and-open.ps1\""

call npm run dev
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo Failed to start. If the port is busy, close the other Rizhai window or run:
  echo   taskkill /F /IM node.exe
  echo Then try start.cmd again.
  pause
)
exit /b %EXITCODE%
