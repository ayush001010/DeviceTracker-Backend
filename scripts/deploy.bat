@echo off
REM Quick deployment script for DeviceTracker (Windows)
REM Usage: scripts\deploy.bat [docker|manual]

setlocal enabledelayedexpansion

set DEPLOY_METHOD=%1
if "%DEPLOY_METHOD%"=="" set DEPLOY_METHOD=docker

echo 🚀 DeviceTracker Deployment Script
echo ==================================
echo.

if "%DEPLOY_METHOD%"=="docker" (
    echo 📦 Deploying with Docker...
    echo.
    
    REM Check if .env exists
    if not exist ".env" (
        echo ⚠️  .env file not found. Please create it manually.
        echo    Copy .env.example to .env and set JWT_SECRET
        exit /b 1
    )
    
    echo 🐳 Starting Docker containers...
    docker-compose up -d
    
    echo.
    echo ✅ Deployment complete!
    echo.
    echo Services:
    echo   - Backend API: http://localhost:4000
    echo   - Web Dashboard: http://localhost
    echo   - MongoDB: localhost:27017
    echo.
    echo Check logs: docker-compose logs -f
    echo Stop services: docker-compose down
    
) else if "%DEPLOY_METHOD%"=="manual" (
    echo 📝 Manual deployment steps:
    echo.
    echo 1. Install dependencies:
    echo    npm install --production
    echo.
    echo 2. Set environment variables (in PowerShell):
    echo    $env:PORT=4000
    echo    $env:MONGO_URI="mongodb://localhost:27017/devicetracker"
    echo    $env:JWT_SECRET="your-secret-here"
    echo    $env:NODE_ENV="production"
    echo.
    echo 3. Start MongoDB service
    echo.
    echo 4. Start the server:
    echo    npm run server
    echo.
    echo 5. Deploy web dashboard to your static host
    echo.
    echo See DEPLOYMENT.md for detailed instructions.
    
) else (
    echo ❌ Unknown deployment method: %DEPLOY_METHOD%
    echo Usage: scripts\deploy.bat [docker|manual]
    exit /b 1
)


