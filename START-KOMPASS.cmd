@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js LTS von https://nodejs.org installieren.
  pause
  exit /b 1
)
node scripts/serve.mjs
pause
