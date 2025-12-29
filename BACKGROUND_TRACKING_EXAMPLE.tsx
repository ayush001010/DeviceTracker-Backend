/**
 * Example: How to integrate background tracking into App.tsx
 * 
 * Add this code to your App.tsx to enable background tracking
 */

import LocationTrackingModule from './LocationTrackingModule';
import {SERVER_URL} from './config';

// Add state for background tracking
const [isBackgroundTracking, setIsBackgroundTracking] = useState(false);

// Function to start background tracking
async function startBackgroundTracking() {
  try {
    if (!deviceId) {
      Alert.alert('Error', 'Device ID not loaded');
      return;
    }
    
    await LocationTrackingModule.startTracking(deviceId, SERVER_URL);
    setIsBackgroundTracking(true);
    Alert.alert('Success', 'Background tracking started');
  } catch (error: any) {
    console.error('Failed to start background tracking:', error);
    Alert.alert('Error', error.message || 'Failed to start background tracking');
  }
}

// Function to stop background tracking
async function stopBackgroundTracking() {
  try {
    await LocationTrackingModule.stopTracking();
    setIsBackgroundTracking(false);
    Alert.alert('Success', 'Background tracking stopped');
  } catch (error: any) {
    console.error('Failed to stop background tracking:', error);
    Alert.alert('Error', error.message || 'Failed to stop background tracking');
  }
}

// Add button in your UI (example)
/*
<TouchableOpacity
  onPress={isBackgroundTracking ? stopBackgroundTracking : startBackgroundTracking}
  style={styles.backgroundButton}>
  <Text style={styles.backgroundButtonText}>
    {isBackgroundTracking ? 'Stop Background Tracking' : 'Start Background Tracking'}
  </Text>
</TouchableOpacity>
*/

// Optional: Check status on app start
useEffect(() => {
  LocationTrackingModule.isTracking()
    .then(isActive => {
      setIsBackgroundTracking(isActive);
    })
    .catch(err => console.log('Error checking tracking status:', err));
}, []);



