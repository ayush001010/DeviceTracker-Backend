# Notification Not Showing - Troubleshooting Guide

## Quick Fixes

### 1. Check Android Logs
Run this command to see what's happening:
```bash
adb logcat | grep -E "LocationService|LocationTrackingModule"
```

Look for:
- "Foreground service started with notification" ✅
- "Notification channel created" ✅
- Any error messages ❌

### 2. Grant Notification Permission (Android 13+)
**Android 13+ requires runtime notification permission:**

1. Go to: **Settings → Apps → DeviceTracker → Notifications**
2. Make sure **"Allow notifications"** is **ON**
3. Or grant permission when prompted

**Manual Check:**
- Settings → Apps → DeviceTracker → Permissions → Notifications
- Enable if disabled

### 3. Check Notification Channel
1. Go to: **Settings → Apps → DeviceTracker → Notifications**
2. Look for **"Location Tracking"** channel
3. Make sure it's **enabled**

### 4. Rebuild and Test
After making changes:
```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

## Common Issues

### Issue: Service starts but no notification
**Solution:**
- Check notification permission (Step 2 above)
- Check if notification channel is enabled
- Check Android logs for errors

### Issue: "ForegroundServiceStartNotAllowedException"
**Solution:**
- Make sure you're using Android 8.0+ (API 26+)
- Service must call `startForeground()` within 5 seconds of `startForegroundService()`

### Issue: Notification appears then disappears
**Solution:**
- Service might be crashing
- Check logs: `adb logcat | grep LocationService`
- Verify location permissions are granted

### Issue: Notification icon is blank/white
**Solution:**
- This is normal - Android requires white icons for notifications
- The notification should still be visible

## Testing Steps

1. **Start tracking** from the app
2. **Check logs:**
   ```bash
   adb logcat | grep LocationService
   ```
3. **Check notification settings:**
   - Settings → Apps → DeviceTracker → Notifications
4. **Pull down notification drawer** - notification should be there
5. **Lock phone** - notification should remain

## What the Notification Should Show

- **Title:** "Location Tracking Active"
- **Text:** "Starting location tracking..." or "Tracking location... (X.Xm)"
- **Icon:** App icon or system icon
- **Cannot be dismissed** while tracking is active

## Still Not Working?

1. **Check if service is running:**
   ```bash
   adb shell dumpsys activity services | grep LocationTrackingService
   ```

2. **Check notification manager:**
   ```bash
   adb shell dumpsys notification | grep Location
   ```

3. **Uninstall and reinstall app:**
   - Sometimes permissions get stuck
   - Uninstall → Reinstall → Grant all permissions

4. **Check Android version:**
   - Minimum: Android 8.0 (API 26)
   - Recommended: Android 10+ for full background support


