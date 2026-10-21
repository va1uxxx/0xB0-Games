@echo off
title 0xB0 Games - local test
echo.
echo   Starting the 0xB0 Games local server...
echo   (the unblocker only works on http://localhost or https://)
echo.
start "0xB0 local server" powershell -ExecutionPolicy Bypass -File "%~dp0server\serve.ps1"
timeout /t 2 /nobreak >nul
start "" http://localhost:8143/
echo.
echo   The site should now be open at http://localhost:8143/
echo.
echo   - Keep the "0xB0 local server" window open while you play.
echo   - Close that window to stop the server.
echo   - The unblocker still needs a bare server set up
echo     (see README.md -^> "Unblocker setup").
echo.
pause
