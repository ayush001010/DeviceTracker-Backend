# Full Persistence Implementation Guide

This guide explains how the app achieves maximum persistence for background GPS tracking on Android.

## 🎯 Persistence Goals

The app tracks location even when:
- ✅ App UI is closed
- ✅ App is swiped from recents
- ✅ Phone is locked
- ✅ Device is rebooted

## 🏗️ Architecture

### 1. Foreground Service

**File:** `LocationTrackingService.kt`

**Key Features:**
- Runs GPS logic in native Android foreground service
- Shows persistent notification (mandatory for foreground services)
- Uses `START_STICKY` flag for auto-restart
- Handles null intent when restarted by Android

**Notification Requirements:**
- Android 8+ (API 26+): Notification channel required
- Android 14+ (API 34+): `foregroundServiceType="location"` required
- Notification must be visible and cannot be dismissed while service runs

### 2. Service Survivability

**START_STICKY Behavior:**
```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Handle null intent (service restarted by Android)
    if (intent == null) {
        restoreStateFromPreferences()
        if (deviceId != null && serverUrl != null) {
            startTracking() // Resume tracking
        }
    }
    return START_STICKY // Android will restart if killed
}
```

**What Happens:**
1. Android kills service (low memory, battery optimization, etc.)
2. Android restarts service with `null` intent
3. Service restores state from SharedPreferences
4. Service resumes tracking automatically

**Duplicate Prevention:**
```kotlin
private fun startTracking() {
    if (isTracking) {
        android.util.Log.d("LocationService", "Already tracking, skipping")
        return
    }
    // ... start tracking ...
}
```

### 3. Boot Persistence

**File:** `BootReceiver.kt`

**How It Works:**
1. User starts tracking → State saved to SharedPreferences
2. Device reboots → `BOOT_COMPLETED` broadcast received
3. BootReceiver checks if tracking was active
4. If yes, restarts foreground service automatically

**Play Store Compliance:**
- Only restarts if user explicitly started tracking before reboot
- State is stored when user starts tracking (explicit user action)
- No hidden behavior or auto-start without user consent

**State Storage:**
```kotlin
// When starting tracking
prefs.edit().apply {
    putBoolean("is_tracking", true)
    putString("device_id", deviceId)
    putString("server_url", serverUrl)
    apply()
}

// When stopping tracking
prefs.edit().apply {
    putBoolean("is_tracking", false)
    remove("device_id")
    remove("server_url")
    apply()
}
```

### 4. Battery Optimization Handling

**File:** `BatteryOptimizationModule.kt`

**Why Critical:**
OEM battery optimization (Samsung, Xiaomi, Huawei, Realme, Oppo) can:
- Kill foreground services after a few minutes
- Prevent services from restarting
- Block network requests in background

**Solution:**
- Detect if battery optimization is enabled
- Guide user to disable it in system settings
- Deep-link to correct settings screen

## 📱 Edge Cases

### 1. Force Stop

**What Happens:**
- User force stops app in Settings → Apps → DeviceTracker → Force Stop
- Service is killed and **cannot restart**
- State is preserved in SharedPreferences

**Recovery:**
- When user opens app again, check if tracking was active
- Restart service if needed

**Code:**
```typescript
// On app launch
const wasTracking = await LocationTrackingModule.isTracking();
if (wasTracking) {
  // Service was force stopped, restart it
  await LocationTrackingModule.startTracking(deviceId, serverUrl);
}
```

### 2. Swipe from Recents

**What Happens:**
- App is removed from recent apps
- Foreground service **continues running**
- Notification remains visible
- Tracking continues normally

**No Action Needed:** Service survives this automatically.

### 3. Device Reboot

**What Happens:**
1. Device reboots
2. `BOOT_COMPLETED` broadcast sent
3. `BootReceiver` receives broadcast
4. Checks SharedPreferences for tracking state
5. If active, restarts foreground service

**Timing:**
- BootReceiver runs ~30-60 seconds after boot
- Service starts automatically
- No user interaction needed

### 4. Low Memory Kill

**What Happens:**
- Android kills service due to low memory
- Service restarts automatically (START_STICKY)
- State restored from SharedPreferences
- Tracking resumes

**Recovery Time:**
- Usually < 5 seconds
- May take longer on very low-end devices

### 5. Battery Optimization Kill

**What Happens:**
- OEM battery optimization kills service
- Service tries to restart (START_STICKY)
- May be killed again immediately
- **Solution:** User must disable battery optimization

### 6. App Uninstall

**What Happens:**
- App uninstalled → Service stops
- SharedPreferences deleted
- No persistence (expected behavior)

## 🔧 AndroidManifest.xml Configuration

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Service -->
<service
    android:name=".LocationTrackingService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="location" />

<!-- Boot Receiver -->
<receiver
    android:name=".BootReceiver"
    android:enabled="true"
    android:exported="true"
    android:permission="android.permission.RECEIVE_BOOT_COMPLETED">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.intent.action.QUICKBOOT_POWERON" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
</receiver>
```

## 📊 State Flow

```
User Starts Tracking
    ↓
Save State to SharedPreferences
    ↓
Start Foreground Service
    ↓
Service Running (Notification Visible)
    ↓
[Edge Cases]
    ├─ App Closed → Service Continues ✅
    ├─ Swiped from Recents → Service Continues ✅
    ├─ Phone Locked → Service Continues ✅
    ├─ Low Memory Kill → Service Restarts ✅
    ├─ Device Reboot → BootReceiver Restarts Service ✅
    └─ Force Stop → Service Stops (User Action) ⚠️
```

## 🧪 Testing Checklist

### Basic Persistence
- [ ] Service continues when app UI is closed
- [ ] Service continues when app is swiped from recents
- [ ] Service continues when phone is locked
- [ ] Notification remains visible in all cases

### Service Survivability
- [ ] Service restarts after being killed (low memory)
- [ ] State is restored correctly after restart
- [ ] No duplicate service instances
- [ ] Notification reappears after restart

### Boot Persistence
- [ ] Service restarts automatically after device reboot
- [ ] State is preserved across reboot
- [ ] Notification appears after boot
- [ ] Tracking resumes correctly

### Edge Cases
- [ ] Force stop → Service stops (expected)
- [ ] App uninstall → Service stops (expected)
- [ ] Battery optimization → Service may be killed (user must disable)

## 🚨 Limitations

### Cannot Survive:
1. **Force Stop** - User explicitly stops app
2. **App Uninstall** - App removed from device
3. **Battery Optimization** - If enabled, may kill service repeatedly
4. **Factory Reset** - All data cleared

### Can Survive:
1. ✅ App close
2. ✅ Swipe from recents
3. ✅ Phone lock
4. ✅ Device reboot
5. ✅ Low memory kill
6. ✅ System updates (usually)

## 📚 Code Files

### Native Android:
- `LocationTrackingService.kt` - Foreground service
- `BootReceiver.kt` - Boot completion receiver
- `LocationTrackingModule.kt` - React Native bridge
- `BatteryOptimizationModule.kt` - Battery optimization handling

### React Native:
- `LocationTrackingModule.ts` - TypeScript interface
- `BatteryOptimizationModule.ts` - TypeScript interface

### Configuration:
- `AndroidManifest.xml` - Permissions and receivers

## 🔍 Debugging

### Check Service Status
```bash
adb shell dumpsys activity services | grep LocationTrackingService
```

### Check Boot Receiver
```bash
adb shell dumpsys package com.devicetracker | grep -A 5 "BootReceiver"
```

### Check State
```bash
adb shell run-as com.devicetracker cat /data/data/com.devicetracker/shared_prefs/LocationTrackingState.xml
```

### Monitor Logs
```bash
adb logcat | grep -E "LocationService|BootReceiver|LocationTrackingModule"
```

## ✅ Play Store Compliance

All implementations are:
- ✅ Using official Android APIs
- ✅ No hidden behavior
- ✅ User consent required (explicit start action)
- ✅ State only saved when user starts tracking
- ✅ Boot restart only if user started tracking before reboot
- ✅ No background activity without user action
- ✅ Compliant with Play Store policies

---

**Result:** Maximum persistence allowed by Android, while remaining Play Store compliant.


