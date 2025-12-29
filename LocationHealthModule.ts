/**
 * React Native bridge module for LocationHealthModule
 * 
 * Provides health status information about location tracking service
 */

import {NativeModules} from 'react-native';

const {LocationHealthModule} = NativeModules;

interface HealthInfo {
  status: 'online' | 'stale' | 'offline';
  lastSuccessfulSendTime: number; // milliseconds since epoch
  timeSinceLastSuccess: number; // milliseconds, -1 if never sent
  isOnline: boolean;
  isStale: boolean;
  isOffline: boolean;
}

interface LocationHealthModuleInterface {
  getHealthStatus(): Promise<'online' | 'stale' | 'offline'>;
  getLastSuccessfulSendTime(): Promise<number>;
  getHealthInfo(): Promise<HealthInfo>;
}

export default LocationHealthModule as LocationHealthModuleInterface;


