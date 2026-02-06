@echo off
echo.
echo   IG-X Downloader - Setup
echo   ========================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [!] Node.js not found.
    echo   Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo   [OK] Node.js found

where pip >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [!] pip not found.
    echo   Please install Python from https://python.org
    pause
    exit /b 1
)
echo   [OK] pip found

echo.
echo   Installing gallery-dl...
pip install gallery-dl
echo   [OK] gallery-dl installed

echo.
echo   Installing Node dependencies...
call npm install
echo   [OK] Dependencies installed

echo.
echo   ========================
echo   Setup complete!
echo.
echo   To start: npm start
echo   Then open: http://localhost:3000
echo.
pause
