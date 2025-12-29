package com.devicetracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import androidx.core.content.ContextCompat
import android.util.Log

/**
 * Broadcast receiver to restart location tracking service after device reboot
 * 
 * This ensures the service can resume tracking automatically after the device
 * is restarted, if it was running before reboot.
 * 
 * Play Store Compliant: Only restarts if user explicitly started tracking before reboot.
 * State is stored in SharedPreferences when user starts tracking.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            Log.d("BootReceiver", "Device booted, checking if service should restart...")
            
            try {
                // Check if tracking was active before reboot
                val prefs: SharedPreferences = context.getSharedPreferences(
                    "LocationTrackingState",
                    Context.MODE_PRIVATE
                )
                
                val wasTracking = prefs.getBoolean("is_tracking", false)
                val deviceId = prefs.getString("device_id", null)
                val serverUrl = prefs.getString("server_url", null)
                
                if (wasTracking && deviceId != null && serverUrl != null) {
                    Log.d("BootReceiver", "Tracking was active before reboot, restarting service...")
                    Log.d("BootReceiver", "DeviceId: $deviceId, ServerUrl: $serverUrl")
                    
                    // Restart the foreground service
                    val serviceIntent = Intent(context, LocationTrackingService::class.java).apply {
                        action = LocationTrackingService.ACTION_START
                        putExtra(LocationTrackingService.EXTRA_DEVICE_ID, deviceId)
                        putExtra(LocationTrackingService.EXTRA_SERVER_URL, serverUrl)
                    }
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        ContextCompat.startForegroundService(context, serviceIntent)
                        Log.d("BootReceiver", "✅ Foreground service restarted after boot")
                    } else {
                        context.startService(serviceIntent)
                        Log.d("BootReceiver", "✅ Service restarted after boot")
                    }
                } else {
                    Log.d("BootReceiver", "Tracking was not active before reboot, skipping restart")
                }
            } catch (e: Exception) {
                Log.e("BootReceiver", "Error restarting service after boot: ${e.message}", e)
            }
        }
    }
}

