@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo.
echo   正在启动手机文件传输工具...
echo.
phone-transfer.exe %*
pause
