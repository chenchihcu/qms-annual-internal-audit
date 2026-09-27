@echo off
chcp 65001 >nul
echo 正在啟動 QMS 年度內部稽核工具...
call "%~dp0start-qms-audit.bat"
exit /b %errorlevel%
