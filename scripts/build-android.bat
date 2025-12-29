@echo off
REM Build script for Android APK (Windows)
REM Usage: scripts\build-android.bat [debug|release]

setlocal enabledelayedexpansion

set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=debug

echo Building Android %BUILD_TYPE% APK...

cd android

if "%BUILD_TYPE%"=="release" (
    echo Building release APK...
    call gradlew.bat assembleRelease
    set APK_PATH=app\build\outputs\apk\release\app-release.apk
    echo ✅ Release APK built: %APK_PATH%
) else (
    echo Building debug APK...
    call gradlew.bat assembleDebug
    set APK_PATH=app\build\outputs\apk\debug\app-debug.apk
    echo ✅ Debug APK built: %APK_PATH%
)

echo.
echo APK location: %CD%\%APK_PATH%
echo.
echo To install on connected device:
echo   adb install %CD%\%APK_PATH%

cd ..


