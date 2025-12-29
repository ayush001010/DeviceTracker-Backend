#!/bin/bash

# Build script for iOS app
# Usage: ./scripts/build-ios.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Preparing iOS build..."

cd "$PROJECT_ROOT/ios"

# Install CocoaPods dependencies
if [ ! -d "Pods" ]; then
    echo "Installing CocoaPods dependencies..."
    bundle install
    bundle exec pod install
fi

echo ""
echo "✅ iOS dependencies installed"
echo ""
echo "To build iOS app:"
echo "  1. Open Xcode:"
echo "     open ios/Mee.xcworkspace"
echo ""
echo "  2. Select your development team in Signing & Capabilities"
echo ""
echo "  3. Choose a device or simulator"
echo ""
echo "  4. Press Cmd+R to build and run"
echo ""
echo "For App Store distribution:"
echo "  - Product → Archive"
echo "  - Distribute App → App Store Connect"


