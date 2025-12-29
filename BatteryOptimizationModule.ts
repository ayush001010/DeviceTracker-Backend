/**
 * React Native bridge module for BatteryOptimizationModule
 * 
 * Provides methods to check and handle battery optimization settings
 */

import {NativeModules} from 'react-native';

const {BatteryOptimizationModule} = NativeModules;

interface BatteryOptimizationModuleInterface {
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  openBatteryOptimizationSettings(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): Promise<boolean>;
}

export default BatteryOptimizationModule as BatteryOptimizationModuleInterface;


