@echo off
REM ==========================================================
REM  Grade 8 Hub - let classmates connect to this computer
REM
REM  Just DOUBLE-CLICK this file. If Windows asks for permission,
REM  click "Yes". You only ever need to do this once.
REM
REM  Only the computer HOSTING the hub needs this. Classmates who
REM  just open the address in their browser do not.
REM ==========================================================
title Grade 8 Hub - allow classmates

REM ---- Ask Windows for permission automatically, so nobody has to
REM ---- know about right-clicking and "Run as administrator". ----
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo.
  echo   Asking Windows for permission...
  echo   Please click "Yes" on the box that appears.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" >nul 2>&1
  if errorlevel 1 (
    echo.
    echo   Windows would not give permission.
    echo.
    echo   This usually means it is a school computer that is locked down.
    echo   You can still use the hub on this computer, but classmates will
    echo   not be able to connect to it. Try hosting on a personal laptop
    echo   instead, and see the README for other options.
    echo.
    pause
  )
  exit /b
)

echo.
echo   Allowing classmates to reach the Grade 8 Hub...
echo.

netsh advfirewall firewall delete rule name="Grade 8 Hub" >nul 2>&1
netsh advfirewall firewall add rule name="Grade 8 Hub" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1

if %errorLevel% neq 0 (
  echo   That did not work. Try again, or ask an adult for help.
  echo.
  pause
  exit /b 1
)

echo   Done. Classmates on the same network can now join.
echo.
echo   This covers Bluetooth, a cable, a router and Wi-Fi - the rule
echo   applies to every kind of network, not just one.
echo.
echo   Next: start the hub with start.bat and give your classmates
echo   the address it prints on screen.
echo.
pause
