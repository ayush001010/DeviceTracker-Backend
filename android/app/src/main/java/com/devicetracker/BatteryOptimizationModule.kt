package com.devicetracker

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.*

/**
 * Module to handle battery optimization detection and settings navigation
 * 
 * Battery optimization can kill background services even if they're foreground services.
 * This module helps detect and guide users to disable it.
 */
class BatteryOptimizationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "BatteryOptimizationModule"
    }

    /**
     * Check if the app is ignoring battery optimization (whitelisted)
     * Returns true if battery optimization is disabled (good for background services)
     */
    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                // Battery optimization only exists on Android 6.0+
                promise.resolve(true) // Assume allowed on older versions
                return
            }

            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoring = powerManager.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)
            
            promise.resolve(isIgnoring)
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", "Failed to check battery optimization: ${e.message}", e)
        }
    }

    /**
     * Open Android system settings to disable battery optimization
     * User must manually toggle the setting
     */
    @ReactMethod
    fun openBatteryOptimizationSettings(promise: Promise) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
                val packageName = reactApplicationContext.packageName
                
                // Try to open specific app's battery optimization settings
                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    // Some devices support direct app settings
                    data = Uri.parse("package:$packageName")
                }
            } else {
                // Fallback to general battery settings on older Android
                Intent(Settings.ACTION_SETTINGS)
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            
            promise.resolve(true)
        } catch (e: Exception) {
            // If specific settings fail, try general battery settings
            try {
                val fallbackIntent = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(fallbackIntent)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("OPEN_ERROR", "Failed to open settings: ${e2.message}", e2)
            }
        }
    }

    /**
     * Request to ignore battery optimization (requires user approval)
     * Note: This shows a system dialog that user must approve
     */
    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true) // Not needed on older versions
                return
            }

            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = reactApplicationContext.packageName

            if (powerManager.isIgnoringBatteryOptimizations(packageName)) {
                promise.resolve(true) // Already ignoring
                return
            }

            // Open system dialog to request permission
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REQUEST_ERROR", "Failed to request battery optimization: ${e.message}", e)
        }
    }
}


