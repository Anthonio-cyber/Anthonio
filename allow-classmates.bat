@echo off
REM ==========================================================
REM  Grade 8 Hub - let classmates connect to this computer
REM
REM  Windows blocks other devices from reaching the hub until
REM  you allow it once. Right-click this file and choose
REM  "Run as administrator". You only need to do it one time.
REM ==========================================================
title Grade 8 Hub - allow classmates

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo.
  echo   This needs administrator permission.
  echo.
  echo   Close this window, then RIGHT-CLICK allow-classmates.bat
  echo   and choose "Run as administrator".
  echo.
  pause
  exit /b 1
)

echo.
echo   Allowing classmates to reach the Grade 8 Hub...
echo.

netsh advfirewall firewall delete rule name="Grade 8 Hub" >nul 2>&1
netsh advfirewall firewall add rule name="Grade 8 Hub" dir=in action=allow protocol=TCP localport=3000 >nul

if %errorLevel% neq 0 (
  echo   Something went wrong. Try again, or ask an adult for help.
  pause
  exit /b 1
)

echo   Done. Classmates on the same hotspot or Wi-Fi can now join.
echo.
echo   Next: start the hub with start.bat, and give your classmates
echo   the address it prints on screen.
echo.
pause
