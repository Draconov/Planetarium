@echo off
setlocal
where node >nul 2>nul || (echo Node.js 20+ is required.& exit /b 1)
start "" http://127.0.0.1:8080
node scripts\serve.mjs src
