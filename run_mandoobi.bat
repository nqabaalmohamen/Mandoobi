@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo      Mandoobi - مندو بي (Startup Script)
echo ==================================================
echo.

:: Get the local IPv4 address using PowerShell
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike '*Loopback*' -and $_.IPv4Address -notlike '169.254.*'} | Select-Object -First 1 -ExpandProperty IPAddress"`) do (
    set LOCAL_IP=%%a
)

echo.
echo [1] To open on this computer:
echo     http://localhost:3000
echo.
echo [2] To open on your MOBILE or other devices:
echo     http://%LOCAL_IP%:3000
echo.
echo (Make sure all devices are on the SAME WiFi)
echo.
echo ==================================================
echo Starting Server... Please wait...
echo ==================================================
echo.

:: Run the development server bound to all interfaces
npm run dev -- -H 0.0.0.0

pause
