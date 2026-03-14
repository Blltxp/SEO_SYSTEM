@echo off
title SEO System
chcp 65001 >nul
cd /d "%~dp0.."
echo [SEO System] Starting...

set "PATH=%PATH%;C:\Program Files\nodejs;%ProgramFiles(x86)%\nodejs;%APPDATA%\npm"
where npm >nul 2>&1 || (
  echo [SEO System] Node/npm not found in PATH.
  echo Install from https://nodejs.org
  echo Project: %CD%
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [SEO System] Installing dependencies...
  call npm install
)
if not exist ".next" (
  echo [SEO System] First build, please wait...
  call npm run build
)

start /min cmd /k "cd /d ""%CD%"" && title SEO System - Server && npm run start"

start "" "http://localhost:3000"
