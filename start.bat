@echo off
REM ==========================================================
REM  GRADE 8 HUB - Windows start file
REM  Double-click this file to start the Grade 8 Hub.
REM ==========================================================
title Grade 8 Hub
cd /d "%~dp0"

echo.
echo ==========================================================
echo   GRADE 8 HUB
echo ==========================================================
echo.

REM ---- Check that Node.js is installed --------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found on this computer.
  echo.
  echo   The Grade 8 Hub needs Node.js version 18 or newer.
  echo   1. Go to  https://nodejs.org
  echo   2. Download the "LTS" version and install it.
  echo   3. Close this window and double-click start.bat again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo   Node.js %NODEVER% found.

REM ---- Install the dependencies the first time ------------
if not exist "node_modules" (
  echo.
  echo   First run - installing what the app needs.
  echo   This can take a few minutes. Please wait.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   The install did not finish. Check your internet connection
    echo   and run start.bat again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo   Starting the server...
echo   When it is ready, open this address in your browser:
echo.
echo       http://localhost:3000
echo.
echo   Leave this window open while you use the hub.
echo   Press Ctrl + C in this window to stop it.
echo.

REM ---- Open the browser after a short pause ---------------
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

call npm start

echo.
echo   The Grade 8 Hub has stopped.
pause
