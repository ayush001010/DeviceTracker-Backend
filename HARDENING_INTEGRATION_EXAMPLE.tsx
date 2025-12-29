/**
 * Example: How to integrate hardening features into App.tsx
 * 
 * This shows how to:
 * 1. Check battery optimization on app start
 * 2. Monitor health status
 * 3. Handle service restart
 */

import React, {useEffect, useState} from 'react';
import {Platform, Alert} from 'react-native';
import BatteryOptimizationModule from './BatteryOptimizationModule';
import LocationHealthModule from './LocationHealthModule';
import LocationTrackingModule from './LocationTrackingModule';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Add to your App component
export default function App() {
  const [healthStatus, setHealthStatus] = useState<'online' | 'stale' | 'offline'>('offline');
  const [batteryOptimizationEnabled, setBatteryOptimizationEnabled] = useState(false);

  // 1. Check battery optimization on app start
  useEffect(() => {
    if (Platform.OS === 'android') {
      checkBatteryOptimization();
    }
  }, []);

  async function checkBatteryOptimization() {
    try {
      const isIgnoring = await BatteryOptimizationModule.isIgnoringBatteryOptimizations();
      setBatteryOptimizationEnabled(!isIgnoring);
      
      // If tracking is active but battery optimization is enabled, warn user
      const isTracking = await LocationTrackingModule.isTracking();
      if (!isIgnoring && isTracking) {
        showBatteryOptimizationWarning();
      }
    } catch (error) {
      console.error('Error checking battery optimization:', error);
    }
  }

  function showBatteryOptimizationWarning() {
    Alert.alert(
      'Battery Optimization Enabled',
      'Battery optimization can stop background tracking. For reliable tracking, please disable it.',
      [
        {text: 'Later', style: 'cancel'},
        {
          text: 'Open Settings',
          onPress: () => {
            BatteryOptimizationModule.openBatteryOptimizationSettings();
          },
        },
      ],
    );
  }

  // 2. Monitor health status
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const interval = setInterval(async () => {
      try {
        const status = await LocationHealthModule.getHealthStatus();
        setHealthStatus(status);

        // Alert if status is stale or offline
        if (status === 'stale') {
          console.warn('⚠️ Tracking health: STALE - Connection issues detected');
        } else if (status === 'offline') {
          console.warn('❌ Tracking health: OFFLINE - Service not running');
        }
      } catch (error) {
        console.error('Error checking health status:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // 3. Handle service restart on app launch
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const checkAndRestartService = async () => {
      try {
        // Check if service was running before app closed
        const wasTracking = await AsyncStorage.getItem('background_tracking_active');
        
        if (wasTracking === 'true') {
          // Service was running, check if it's still running
          const isRunning = await LocationTrackingModule.isTracking();
          
          if (!isRunning) {
            // Service stopped, restart it
            const deviceId = await AsyncStorage.getItem('device_id');
            const serverUrl = 'YOUR_SERVER_URL'; // Get from config
            
            if (deviceId) {
              await LocationTrackingModule.startTracking(deviceId, serverUrl);
              console.log('✅ Service restarted after app launch');
            }
          }
        }
      } catch (error) {
        console.error('Error checking service status:', error);
      }
    };

    checkAndRestartService();
  }, []);

  // 4. Save tracking state when starting/stopping
  async function startBackgroundTracking() {
    try {
      // ... your existing start tracking code ...
      
      // Save state
      await AsyncStorage.setItem('background_tracking_active', 'true');
      
      // Check battery optimization
      const isIgnoring = await BatteryOptimizationModule.isIgnoringBatteryOptimizations();
      if (!isIgnoring) {
        // Warn user but don't block
        setTimeout(() => {
          showBatteryOptimizationWarning();
        }, 2000); // Show after 2 seconds
      }
    } catch (error) {
      console.error('Error starting tracking:', error);
    }
  }

  async function stopBackgroundTracking() {
    try {
      // ... your existing stop tracking code ...
      
      // Clear state
      await AsyncStorage.removeItem('background_tracking_active');
    } catch (error) {
      console.error('Error stopping tracking:', error);
    }
  }

  // 5. Display health status in UI
  function getHealthStatusColor() {
    switch (healthStatus) {
      case 'online':
        return '#10B981'; // Green
      case 'stale':
        return '#F59E0B'; // Yellow
      case 'offline':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  }

  function getHealthStatusText() {
    switch (healthStatus) {
      case 'online':
        return 'Online';
      case 'stale':
        return 'Connection Issues';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  }

  // Add to your UI:
  /*
  <View style={styles.healthStatus}>
    <View style={[styles.healthIndicator, {backgroundColor: getHealthStatusColor()}]} />
    <Text style={styles.healthText}>{getHealthStatusText()}</Text>
    {batteryOptimizationEnabled && (
      <TouchableOpacity onPress={showBatteryOptimizationWarning}>
        <Text style={styles.warningText}>⚠️ Battery optimization enabled</Text>
      </TouchableOpacity>
    )}
  </View>
  */
}


