package com.devicetracker

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.facebook.react.bridge.*
import android.util.Log

/**
 * Module to expose location tracking health status to React Native
 * 
 * Provides:
 * - Online/Stale/Offline status
 * - Last successful location send time
 * - Service running status
 */
class LocationHealthModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var service: LocationTrackingService? = null
    private var isBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val localBinder = binder as? LocationTrackingService.LocalBinder
            service = localBinder?.getService()
            isBound = true
            Log.d("LocationHealthModule", "Service connected")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            isBound = false
            Log.d("LocationHealthModule", "Service disconnected")
        }
    }

    override fun getName(): String {
        return "LocationHealthModule"
    }

    /**
     * Get current health status: "online", "stale", or "offline"
     */
    @ReactMethod
    fun getHealthStatus(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("LocationTrackingHealth", Context.MODE_PRIVATE)
            val status = prefs.getString("service_status", "offline") ?: "offline"
            promise.resolve(status)
        } catch (e: Exception) {
            Log.e("LocationHealthModule", "Error getting health status: ${e.message}")
            promise.reject("STATUS_ERROR", "Failed to get health status: ${e.message}", e)
        }
    }

    /**
     * Get last successful location send timestamp (milliseconds since epoch)
     * Returns 0 if never sent successfully
     */
    @ReactMethod
    fun getLastSuccessfulSendTime(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("LocationTrackingHealth", Context.MODE_PRIVATE)
            val timestamp = prefs.getLong("last_successful_send", 0)
            promise.resolve(timestamp.toDouble())
        } catch (e: Exception) {
            Log.e("LocationHealthModule", "Error getting last send time: ${e.message}")
            promise.reject("TIME_ERROR", "Failed to get last send time: ${e.message}", e)
        }
    }

    /**
     * Get detailed health information
     */
    @ReactMethod
    fun getHealthInfo(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("LocationTrackingHealth", Context.MODE_PRIVATE)
            val status = prefs.getString("service_status", "offline") ?: "offline"
            val lastSuccess = prefs.getLong("last_successful_send", 0)
            
            val now = System.currentTimeMillis()
            val timeSinceLastSuccess = if (lastSuccess > 0) now - lastSuccess else -1
            
            val healthInfo = Arguments.createMap().apply {
                putString("status", status)
                putDouble("lastSuccessfulSendTime", lastSuccess.toDouble())
                putDouble("timeSinceLastSuccess", timeSinceLastSuccess.toDouble())
                putBoolean("isOnline", status == "online")
                putBoolean("isStale", status == "stale")
                putBoolean("isOffline", status == "offline")
            }
            
            promise.resolve(healthInfo)
        } catch (e: Exception) {
            Log.e("LocationHealthModule", "Error getting health info: ${e.message}")
            promise.reject("INFO_ERROR", "Failed to get health info: ${e.message}", e)
        }
    }
}


