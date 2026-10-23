@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Sakura Vape Shop

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите LTS-версию с https://nodejs.org и запустите снова.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Устанавливаю зависимости...
  call npm install
  if errorlevel 1 goto fail
)

node scripts\local.mjs
pause
exit /b 0

:fail
echo.
echo Что-то пошло не так, смотрите сообщения выше.
pause
exit /b 1
