/**
 * React Native bridge module for LocationTrackingService
 * 
 * This module provides methods to start/stop background GPS tracking
 * using Android Foreground Service.
 */

import {NativeModules, NativeEventEmitter} from 'react-native';

const {LocationTrackingModule} = NativeModules;

interface LocationTrackingModuleInterface {
  startTracking(deviceId: string, serverUrl: string): Promise<boolean>;
  stopTracking(): Promise<boolean>;
  isTracking(): Promise<boolean>;
}

export default LocationTrackingModule as LocationTrackingModuleInterface;



