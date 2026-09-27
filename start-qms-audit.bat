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
  echo [1/2] Installing locked dependencies...
  call npm ci --include=dev
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/2] node_modules exists, skip install.
)

echo [2/2] Starting local server at http://127.0.0.1:43124/
echo The browser opens when the server is ready. Close this window to stop the server.
echo.

call npm run dev -- --open
if errorlevel 1 (
  echo [ERROR] The local server stopped or failed to start. Check whether port 43124 is already in use.
  pause
  exit /b 1
)
pause
