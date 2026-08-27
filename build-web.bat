@echo off
setlocal
where node >nul 2>nul || (echo Node.js 20+ is required.& exit /b 1)
call npm run check || exit /b 1
call npm run build:web || exit /b 1
echo.
echo Web build created in dist\web
