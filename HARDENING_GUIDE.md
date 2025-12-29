# Background GPS Tracking - Hardening Guide

This document explains the hardening features implemented for long-term reliability.

## 🔋 Battery Optimization Handling

### Why It's Dangerous

**Battery optimization** (Doze mode, App Standby) can kill background services even if they're foreground services. OEMs (Samsung, Xiaomi, Huawei, etc.) have aggressive battery optimization that can:

- Kill foreground services after a few minutes
- Prevent services from restarting
- Block network requests in background
- Stop location updates

**Result:** Your tracking service stops working even though it's a foreground service.

### Implementation

#### 1. Detection (`BatteryOptimizationModule.kt`)

```kotlin
// Check if app is whitelisted from battery optimization
isIgnoringBatteryOptimizations() -> Promise<boolean>
```

Returns `true` if battery optimization is disabled (good), `false` if enabled (bad).

#### 2. User Guidance

```kotlin
// Open battery optimization settings
openBatteryOptimizationSettings() -> Promise<boolean>
```

Opens Android system settings where user can disable battery optimization.

#### 3. Permission Request (Android 6.0+)

```kotlin
// Request to ignore battery optimization
requestIgnoreBatteryOptimizations() -> Promise<boolean>
```

Shows system dialog to request permission (user must approve).

### React Native Integration

```typescript
import BatteryOptimizationModule from './BatteryOptimizationModule';

// Check status
const isIgnoring = await BatteryOptimizationModule.isIgnoringBatteryOptimizations();

if (!isIgnoring) {
  // Prompt user to disable battery optimization
  Alert.alert(
    'Battery Optimization',
    'Battery optimization can stop background tracking. Please disable it for reliable tracking.',
    [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Open Settings',
        onPress: () => BatteryOptimizationModule.openBatteryOptimizationSettings()
      }
    ]
  );
}
```

## 🔄 Service Survivability

### START_STICKY Flag

The service uses `START_STICKY` return value:

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // ... handle start/stop ...
    return START_STICKY // Restart if killed by system
}
```

**What it does:**
- If Android kills the service (low memory), it will restart automatically
- Service restarts with `null` intent, so we handle that gracefully

### Duplicate Prevention

```kotlin
override fun onCreate() {
    // ...
    if (isTracking) {
        android.util.Log.w("LocationService", "Service already tracking, skipping duplicate start")
    }
}
```

Prevents multiple service instances from running simultaneously.

### Boot Receiver

`BootReceiver.kt` listens for device reboot:

```xml
<receiver android:name=".BootReceiver">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

**Note:** We don't auto-start on boot (privacy). The app checks on launch if tracking should resume.

## 📊 Health Signals

### Status Types

- **`online`**: Service is running and successfully sending locations
- **`stale`**: Service is running but hasn't sent successfully in >1 minute or has 5+ consecutive failures
- **`offline`**: Service is not running

### Implementation

#### Service Side (`LocationTrackingService.kt`)

Tracks:
- `lastSuccessfulSendTime`: Timestamp of last successful location send
- `consecutiveFailures`: Count of failed sends
- Status saved to SharedPreferences for React Native access

```kotlin
// On successful send
lastSuccessfulSendTime = System.currentTimeMillis()
consecutiveFailures = 0
saveHealthData("online")

// On failure
consecutiveFailures++
if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    saveHealthData("stale")
}
```

#### React Native Side (`LocationHealthModule.ts`)

```typescript
import LocationHealthModule from './LocationHealthModule';

// Get status
const status = await LocationHealthModule.getHealthStatus();
// Returns: "online" | "stale" | "offline"

// Get detailed info
const healthInfo = await LocationHealthModule.getHealthInfo();
// Returns: {
//   status: "online" | "stale" | "offline",
//   lastSuccessfulSendTime: number,
//   timeSinceLastSuccess: number,
//   isOnline: boolean,
//   isStale: boolean,
//   isOffline: boolean
// }
```

### Dashboard Integration

Expose health status to your web dashboard:

```typescript
// Poll health status every 10 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const healthInfo = await LocationHealthModule.getHealthInfo();
    
    // Send to backend
    await fetch(`${SERVER_URL}/api/device/health/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify(healthInfo)
    });
  }, 10000);
  
  return () => clearInterval(interval);
}, []);
```

## 🛡️ Best Practices

### 1. Check Battery Optimization on App Start

```typescript
useEffect(() => {
  checkBatteryOptimization();
}, []);

async function checkBatteryOptimization() {
  if (Platform.OS !== 'android') return;
  
  const isIgnoring = await BatteryOptimizationModule.isIgnoringBatteryOptimizations();
  if (!isIgnoring && isBackgroundTracking) {
    // Show warning if tracking is active but battery optimization is enabled
    showBatteryOptimizationWarning();
  }
}
```

### 2. Monitor Health Status

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await LocationHealthModule.getHealthStatus();
    if (status === 'stale' || status === 'offline') {
      // Alert user or show warning
      console.warn('Tracking health issue:', status);
    }
  }, 30000); // Check every 30 seconds
  
  return () => clearInterval(interval);
}, []);
```

### 3. Handle Service Restart

The service will restart automatically if killed, but you should verify it's running:

```typescript
useEffect(() => {
  // Check if service should be running
  const checkService = async () => {
    const wasTracking = await AsyncStorage.getItem('was_tracking');
    if (wasTracking === 'true') {
      // Service was running before, restart it
      await startBackgroundTracking();
    }
  };
  
  checkService();
}, []);
```

## 📱 OEM-Specific Issues

### Samsung
- Aggressive battery optimization
- "App power monitor" can kill services
- Solution: Disable in Settings → Device care → Battery → App power monitor

### Xiaomi (MIUI)
- Very aggressive background restrictions
- "Battery saver" mode kills services
- Solution: Settings → Battery → Battery optimization → Don't optimize

### Huawei
- "App launch" settings restrict background
- Solution: Settings → Apps → App launch → Manual → Allow background activity

### OnePlus (OxygenOS)
- "Battery optimization" can be aggressive
- Solution: Settings → Battery → Battery optimization → Don't optimize

## ✅ Testing Checklist

- [ ] Service survives app close
- [ ] Service survives phone lock
- [ ] Service survives battery optimization enabled (should warn user)
- [ ] Service restarts after being killed
- [ ] Health status updates correctly
- [ ] Dashboard shows correct status
- [ ] Battery optimization detection works
- [ ] Settings navigation works

## 🔍 Debugging

### Check Service Status
```bash
adb shell dumpsys activity services | grep LocationTrackingService
```

### Check Battery Optimization
```bash
adb shell dumpsys deviceidle | grep -A 10 "DeviceTracker"
```

### Check Health Data
```bash
adb shell run-as com.devicetracker cat /data/data/com.devicetracker/shared_prefs/LocationTrackingHealth.xml
```

## 📚 References

- [Android Battery Optimization](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Foreground Services](https://developer.android.com/guide/components/foreground-services)
- [START_STICKY Documentation](https://developer.android.com/reference/android/app/Service#START_STICKY)


