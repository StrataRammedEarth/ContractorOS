@echo off
title ContractorOS Preview
cd /d "%~dp0"

echo.
echo Starting ContractorOS...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Preview.ps1"

echo.
echo This window can now be closed.
pause
