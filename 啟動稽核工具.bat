@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo  QMS Annual Internal Audit Tool
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json missing in this folder.
  echo Unpack the project here first, then run again.
  echo Path: %CD%
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [1/2] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/2] node_modules exists, skip install.
)

echo [2/2] Starting dev server...
echo Browser will open shortly. Close this window to stop the server.
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:43123/"
call npm run dev
pause