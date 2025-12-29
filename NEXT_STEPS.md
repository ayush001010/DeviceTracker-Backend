# Next Steps: Background GPS Tracking

## ✅ What's Been Done

1. ✅ Created Android Foreground Service (`LocationTrackingService.kt`)
2. ✅ Created React Native Bridge Module (`LocationTrackingModule.kt`)
3. ✅ Registered package in `MainApplication.kt`
4. ✅ Added all required permissions to `AndroidManifest.xml`
5. ✅ Integrated UI controls into `App.tsx`
6. ✅ Added TypeScript interface (`LocationTrackingModule.ts`)

## 🚀 Next Steps

### Step 1: Rebuild the Android App

The native code needs to be compiled. Run these commands:

```bash
# Clean previous builds
cd android
./gradlew clean
cd ..

# Rebuild and run
npx react-native run-android
```

**OR** if you're using Android Studio:
1. Open `android/` folder in Android Studio
2. Click "Sync Project with Gradle Files"
3. Build → Rebuild Project
4. Run the app

### Step 2: Grant Background Location Permission (Android 10+)

**Important:** Android 10+ requires special permission for background location.

When you first start background tracking:
1. The app will request location permission
2. **You must select "Allow all the time"** (not just "While using the app")
3. If you only grant "While using the app", background tracking won't work

**Manual Permission Check:**
- Go to: Settings → Apps → DeviceTracker → Permissions → Location
- Select: **"Allow all the time"**

### Step 3: Disable Battery Optimization

To ensure the service runs reliably:

1. Go to: Settings → Apps → DeviceTracker → Battery
2. Select: **"Unrestricted"** or **"Don't optimize"**

This prevents Android from killing the service to save battery.

### Step 4: Test the Implementation

1. **Start the app** and wait for location to load
2. **Tap "Start Background Tracking"** button
3. You should see:
   - Alert: "Background tracking started"
   - Persistent notification: "Location Tracking Active"
   - Button changes to "Stop Background Tracking" (red)

4. **Test scenarios:**
   - ✅ Minimize the app → Notification should remain
   - ✅ Lock the phone → Service continues
   - ✅ Switch to another app → Service continues
   - ✅ Check backend → Location updates should keep arriving

5. **Stop tracking:**
   - Open app → Tap "Stop Background Tracking"
   - Notification should disappear

### Step 5: Verify Backend is Receiving Updates

Check your backend logs or database:
- Location updates should continue even when app is closed
- Updates should have good accuracy (≤ 30m threshold)
- Device ID should match your device

## 🔧 Troubleshooting

### Service Not Starting

**Error:** "Failed to start background tracking"

**Solutions:**
1. Check if location permission is granted
2. Verify `FOREGROUND_SERVICE_LOCATION` permission in manifest
3. Check Android logs: `adb logcat | grep LocationService`
4. Ensure you're testing on Android 9+ device

### Service Stops Unexpectedly

**Possible causes:**
1. Battery optimization is enabled → Disable it (Step 3)
2. Only "While using app" permission → Grant "Allow all the time" (Step 2)
3. Device in Doze mode → Disable battery optimization

### No Location Updates

**Check:**
1. GPS is enabled on device
2. Location services are enabled
3. Backend server is accessible
4. Network connectivity is available
5. Check logs: `adb logcat | grep LocationService`

### Notification Not Showing

**Solutions:**
1. Check notification permissions (Android 13+)
2. Verify notification channel is created
3. Check if service is actually running
4. Restart the app

### Build Errors

**If you get compilation errors:**

```bash
# Clean everything
cd android
./gradlew clean
./gradlew cleanBuildCache
cd ..

# Clear React Native cache
npx react-native start --reset-cache

# Rebuild
npx react-native run-android
```

## 📱 Android Version Requirements

- **Minimum:** Android 8.0 (API 26)
- **Recommended:** Android 10+ (API 29) for full background support
- **Android 12+:** Requires `FOREGROUND_SERVICE_LOCATION` permission (already added)
- **Android 14+:** Stricter background location requirements

## 🎯 What Happens When Tracking is Active

1. **Foreground Service** runs continuously
2. **Persistent Notification** shows "Location Tracking Active"
3. **GPS Updates** every 5 seconds (or 10 meters movement)
4. **Location Sent** to backend when accuracy ≤ 30 meters
5. **Service Survives:**
   - App minimization
   - Phone lock
   - App switching
   - System memory pressure (usually)

## 📝 Code Integration Summary

The following was added to `App.tsx`:

- **Import:** `LocationTrackingModule`
- **State:** `isBackgroundTracking`
- **Functions:** `startBackgroundTracking()`, `stopBackgroundTracking()`
- **UI:** Background tracking card with start/stop button
- **Auto-check:** Status checked on app start

## 🔐 Privacy & Security

- Service only runs when explicitly started by user
- User can stop tracking anytime
- Notification clearly indicates tracking is active
- All location data sent to your backend (not stored locally)

## ✅ Success Criteria

You'll know it's working when:
- ✅ Notification appears and stays visible
- ✅ Location updates continue after closing app
- ✅ Backend receives location updates every 5-10 seconds
- ✅ Service survives phone lock and app switching

---

**Ready to test?** Start with Step 1 (rebuild the app)!


