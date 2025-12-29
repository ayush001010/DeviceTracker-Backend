#!/bin/bash

# Build script for Android APK
# Usage: ./scripts/build-android.sh [debug|release]

set -e

BUILD_TYPE=${1:-debug}
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Building Android ${BUILD_TYPE} APK..."

cd "$PROJECT_ROOT/android"

if [ "$BUILD_TYPE" = "release" ]; then
    echo "Building release APK..."
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
    echo "✅ Release APK built: $APK_PATH"
else
    echo "Building debug APK..."
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
    echo "✅ Debug APK built: $APK_PATH"
fi

echo ""
echo "APK location: $PROJECT_ROOT/$APK_PATH"
echo ""
echo "To install on connected device:"
echo "  adb install $PROJECT_ROOT/$APK_PATH"


