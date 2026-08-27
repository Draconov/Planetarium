@echo off
setlocal
where npm >nul 2>nul || (echo Node.js 20+ is required.& exit /b 1)
where cargo >nul 2>nul || (echo Rust is required. Install it from https://rustup.rs and the Visual Studio C++ Build Tools.& exit /b 1)
if not exist node_modules\.bin\tauri.cmd call npm install || exit /b 1
call npm run dev:desktop
