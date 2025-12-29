package com.devicetracker

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import android.util.Log

class LocationTrackingModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "LocationTrackingModule"
    }

    @ReactMethod
    fun startTracking(deviceId: String, serverUrl: String, promise: Promise) {
        try {
            val context: Context = reactApplicationContext
            Log.d("LocationTrackingModule", "=== Starting tracking service ===")
            Log.d("LocationTrackingModule", "DeviceId: $deviceId")
            Log.d("LocationTrackingModule", "ServerUrl: $serverUrl")
            
            // Save tracking state for boot persistence
            val prefs = context.getSharedPreferences("LocationTrackingState", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putBoolean("is_tracking", true)
                putString("device_id", deviceId)
                putString("server_url", serverUrl)
                apply()
            }
            Log.d("LocationTrackingModule", "Tracking state saved for boot persistence")
            
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_START
                putExtra(LocationTrackingService.EXTRA_DEVICE_ID, deviceId)
                putExtra(LocationTrackingService.EXTRA_SERVER_URL, serverUrl)
            }

            Log.d("LocationTrackingModule", "Intent created, starting service...")
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    ContextCompat.startForegroundService(context, intent)
                    Log.d("LocationTrackingModule", "✅ Foreground service started (Android O+)")
                } catch (e: Exception) {
                    Log.e("LocationTrackingModule", "❌ Failed to start foreground service: ${e.message}", e)
                    // Clear state on failure
                    prefs.edit().putBoolean("is_tracking", false).apply()
                    throw e
                }
            } else {
                try {
                    context.startService(intent)
                    Log.d("LocationTrackingModule", "✅ Service started (Android < O)")
                } catch (e: Exception) {
                    Log.e("LocationTrackingModule", "❌ Failed to start service: ${e.message}", e)
                    // Clear state on failure
                    prefs.edit().putBoolean("is_tracking", false).apply()
                    throw e
                }
            }

            // Give service a moment to start
            Thread.sleep(500)
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("LocationTrackingModule", "❌ Failed to start tracking: ${e.message}", e)
            e.printStackTrace()
            promise.reject("START_ERROR", e.message ?: "Failed to start tracking", e)
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        try {
            val context: Context = reactApplicationContext

            // Clear tracking state (prevents auto-restart after reboot)
            val prefs = context.getSharedPreferences("LocationTrackingState", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putBoolean("is_tracking", false)
                remove("device_id")
                remove("server_url")
                apply()
            }
            Log.d("LocationTrackingModule", "Tracking state cleared")

            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_STOP
            }

            context.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message ?: "Failed to stop tracking", e)
        }
    }

    @ReactMethod
    fun isTracking(promise: Promise) {
        try {
            val context: Context = reactApplicationContext
            val prefs = context.getSharedPreferences("LocationTrackingState", Context.MODE_PRIVATE)
            val isTracking = prefs.getBoolean("is_tracking", false)
            promise.resolve(isTracking)
        } catch (e: Exception) {
            Log.e("LocationTrackingModule", "Error checking tracking status: ${e.message}")
            promise.reject("CHECK_ERROR", "Failed to check tracking status: ${e.message}", e)
        }
    }
}


