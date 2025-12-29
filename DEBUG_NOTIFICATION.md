# Debug Notification Not Showing

## Quick Debug Steps

### 1. Check if Service is Starting

Run this command to see service logs:
```bash
adb logcat | grep -E "LocationService|LocationTrackingModule"
```

**What to look for:**
- ✅ "Starting tracking service..."
- ✅ "onStartCommand called with action: com.devicetracker.START_TRACKING"
- ✅ "Notification channel created"
- ✅ "Foreground service started with notification"
- ❌ Any error messages

### 2. Check if Notification Channel Exists

```bash
adb shell dumpsys notification | grep -A 10 "Location Tracking"
```

### 3. Check if Service is Running

```bash
adb shell dumpsys activity services | grep LocationTrackingService
```

### 4. Check Notification Manager

```bash
adb shell dumpsys notification | grep -i "location"
```

### 5. Test Notification Permission (Android 13+)

1. Go to: **Settings → Apps → DeviceTracker → Notifications**
2. Make sure **"Allow notifications"** is **ON**
3. Check if **"Location Tracking"** channel exists and is enabled

### 6. Check Notification Settings

1. Pull down notification drawer
2. Long press on any notification area
3. Check if "Location Tracking" channel is listed
4. Make sure it's not blocked or hidden

## Common Issues

### Issue: Service starts but no notification
**Check:**
- Notification permission granted? (Android 13+)
- Notification channel enabled?
- Check logs for errors

### Issue: "ForegroundServiceStartNotAllowedException"
**Solution:**
- Service must call `startForeground()` within 5 seconds
- Make sure you're on Android 8.0+

### Issue: Notification appears then disappears
**Solution:**
- Service might be crashing
- Check full logs: `adb logcat | grep LocationService`

### Issue: Notification icon is blank
**Solution:**
- This is normal - Android requires white/transparent icons
- Notification should still be visible

## Manual Test

1. **Start tracking** from app
2. **Check logs immediately:**
   ```bash
   adb logcat -c  # Clear logs
   adb logcat | grep LocationService
   ```
3. **Pull down notification drawer** - should see notification
4. **If not visible, check:**
   - Settings → Apps → DeviceTracker → Notifications
   - Make sure channel is enabled

## Expected Log Output

When working correctly, you should see:
```
LocationTrackingModule: Starting tracking service...
LocationTrackingModule: Foreground service started (Android O+)
LocationService: onStartCommand called with action: com.devicetracker.START_TRACKING
LocationService: Starting with deviceId: xxx, serverUrl: http://...
LocationService: Starting location tracking...
LocationService: Notification channel created: location_tracking_channel
LocationService: Creating notification with text: Starting location tracking...
LocationService: Using icon resource: 2131165279
LocationService: Notification created successfully
LocationService: Created notification, starting foreground...
LocationService: ✅ Foreground service started with notification ID: 1001
LocationService: Notification manually posted
```

If you see errors instead, share them!


