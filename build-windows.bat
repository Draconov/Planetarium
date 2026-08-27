@echo off
setlocal
where npm >nul 2>nul || (echo Node.js 20+ is required.& exit /b 1)
if not exist node_modules\.bin\electron-builder.cmd (
  echo Installing build dependencies...
  call npm install || exit /b 1
)
call npm run build:win || exit /b 1
echo.
echo Windows executable created in release\
