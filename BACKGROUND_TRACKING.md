# Background GPS Tracking Implementation

This document explains how background location tracking works in the DeviceTracker app.

## Overview

The app uses an **Android Foreground Service** to track GPS location even when:
- App is minimized
- Phone is locked
- User switches to other apps

## Architecture

### Components

1. **LocationTrackingService.kt** - Android foreground service that runs in the background
2. **LocationTrackingModule.kt** - React Native bridge to control the service
3. **LocationTrackingPackage.kt** - Package registration for React Native

### How It Works

#### 1. Foreground Service
- A foreground service is a special type of service that shows a persistent notification
- Android allows foreground services to run indefinitely (unlike background services)
- The service uses `LocationManager` to get GPS updates
- Location updates are sent directly to your backend server

#### 2. Surviving Background & Lock Screen

**Why it works:**
- **Foreground Service**: Android prioritizes foreground services and keeps them running
- **START_STICKY**: Service restarts automatically if killed by the system
- **Wake Lock**: Prevents CPU from sleeping (optional, can be added if needed)
- **Notification**: Required by Android - user sees ongoing notification

**Limitations:**
- Android may still kill the service under extreme memory pressure
- Battery optimization settings can affect service behavior
- User can manually stop the service via notification or app settings

#### 3. Permissions

**Required Permissions:**
- `ACCESS_FINE_LOCATION` - For GPS location
- `ACCESS_COARSE_LOCATION` - For network-based location (fallback)
- `ACCESS_BACKGROUND_LOCATION` - For Android 10+ background location access
- `FOREGROUND_SERVICE` - For Android 9+ foreground service
- `FOREGROUND_SERVICE_LOCATION` - For Android 12+ location foreground service

**Android 14+ Considerations:**
- Users must grant "Allow all the time" location permission
- App must request background location permission separately
- System shows a persistent indicator when background location is active

## Usage in React Native

### Import the Module

```typescript
import LocationTrackingModule from './LocationTrackingModule';
import {SERVER_URL} from './config';
```

### Start Background Tracking

```typescript
async function startBackgroundTracking() {
  try {
    const deviceId = await getOrCreateDeviceId();
    await LocationTrackingModule.startTracking(deviceId, SERVER_URL);
    console.log('✅ Background tracking started');
  } catch (error) {
    console.error('❌ Failed to start tracking:', error);
  }
}
```

### Stop Background Tracking

```typescript
async function stopBackgroundTracking() {
  try {
    await LocationTrackingModule.stopTracking();
    console.log('✅ Background tracking stopped');
  } catch (error) {
    console.error('❌ Failed to stop tracking:', error);
  }
}
```

### Check if Tracking is Active

```typescript
async function checkTrackingStatus() {
  try {
    const isActive = await LocationTrackingModule.isTracking();
    console.log('Tracking active:', isActive);
  } catch (error) {
    console.error('Error checking status:', error);
  }
}
```

## Integration with Existing Code

The service reuses your existing backend API:
- Same endpoint: `POST /api/location`
- Same payload format: `{deviceId, latitude, longitude, accuracy}`
- Same accuracy threshold: Only sends when accuracy ≤ 30 meters

## Notification

The service shows a persistent notification:
- **Title**: "Location Tracking Active"
- **Content**: Current status (e.g., "Tracking location... (15.2m)")
- **Action**: Tap to open the app
- **Cannot be dismissed**: User must stop tracking from the app

## Testing

1. **Start the service** from your React Native app
2. **Minimize the app** - notification should remain visible
3. **Lock the phone** - service continues running
4. **Switch apps** - service continues in background
5. **Check backend** - location updates should continue arriving

## Troubleshooting

### Service Not Starting
- Check if location permissions are granted
- Verify `FOREGROUND_SERVICE_LOCATION` permission in manifest
- Check Android logs: `adb logcat | grep LocationService`

### Service Stops Unexpectedly
- Check battery optimization settings (disable for your app)
- Verify "Allow all the time" location permission is granted
- Check if device has "Doze mode" restrictions

### No Location Updates
- Verify GPS is enabled on device
- Check if location services are enabled
- Verify backend server is accessible
- Check network connectivity

### Notification Not Showing
- Verify notification channel is created (Android 8+)
- Check notification permissions (Android 13+)
- Verify service is actually running

## Battery Optimization

To ensure the service runs reliably:
1. Go to Settings → Apps → DeviceTracker
2. Battery → Unrestricted (or "Don't optimize")
3. This prevents Android from killing the service

## Android Version Compatibility

- **Android 8.0+**: Notification channel required
- **Android 9.0+**: `FOREGROUND_SERVICE` permission required
- **Android 10+**: `ACCESS_BACKGROUND_LOCATION` permission required
- **Android 12+**: `FOREGROUND_SERVICE_LOCATION` permission required
- **Android 14+**: Stricter background location requirements

## Security & Privacy

- Service only tracks when explicitly started by user
- User can stop tracking anytime via app or notification
- All location data sent to your backend (not stored locally by service)
- Notification clearly indicates tracking is active

## Next Steps

1. Add UI button to start/stop background tracking
2. Add permission request flow for background location (Android 10+)
3. Add battery optimization prompt
4. Add service status indicator in app
5. Handle service restart on app launch



