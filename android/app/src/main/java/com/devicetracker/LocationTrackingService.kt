package com.devicetracker

import android.app.*
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Binder
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class LocationTrackingService : Service(), LocationListener {
    private val binder = LocalBinder()
    private var locationManager: LocationManager? = null
    private var executor: ScheduledExecutorService? = null
    private var deviceId: String? = null
    private var serverUrl: String? = null
    private var isTracking = false
    private var lastLocation: Location? = null
    
    // Health tracking
    private var lastSuccessfulSendTime: Long = 0
    private var consecutiveFailures: Int = 0
    private val MAX_CONSECUTIVE_FAILURES = 5
    
    // Notification
    private val NOTIFICATION_ID = 1001
    private val CHANNEL_ID = "location_tracking_channel"
    private var notificationCheckCounter: Int = 0 // Counter for periodic notification check
    
    // SharedPreferences key for health data
    private val PREFS_NAME = "LocationTrackingHealth"
    private val KEY_LAST_SUCCESS = "last_successful_send"
    private val KEY_STATUS = "service_status"
    
    inner class LocalBinder : Binder() {
        fun getService(): LocationTrackingService = this@LocationTrackingService
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        executor = Executors.newSingleThreadScheduledExecutor()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        android.util.Log.d("LocationService", "onStartCommand called with action: ${intent?.action}")
        
        // Handle null intent (service restarted by Android after being killed)
        if (intent == null || intent.action == null) {
            android.util.Log.d("LocationService", "Service restarted by system (null intent), restoring state...")
            restoreStateFromPreferences()
            if (deviceId != null && serverUrl != null) {
                android.util.Log.d("LocationService", "Restored state, restarting tracking...")
                startTracking()
            } else {
                android.util.Log.w("LocationService", "No saved state found, stopping service")
                stopSelf()
            }
            return START_STICKY
        }
        
        when (intent.action) {
            ACTION_START -> {
                deviceId = intent.getStringExtra(EXTRA_DEVICE_ID)
                serverUrl = intent.getStringExtra(EXTRA_SERVER_URL)
                android.util.Log.d("LocationService", "Starting with deviceId: $deviceId, serverUrl: $serverUrl")
                startTracking()
            }
            ACTION_STOP -> {
                android.util.Log.d("LocationService", "Stopping tracking")
                stopTracking()
                clearStateFromPreferences()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            else -> {
                android.util.Log.w("LocationService", "Unknown action: ${intent.action}")
            }
        }
        return START_STICKY // Restart if killed by system
    }
    
    /**
     * Restore tracking state from SharedPreferences
     * Called when service is restarted by Android after being killed
     */
    private fun restoreStateFromPreferences() {
        try {
            val prefs = getSharedPreferences("LocationTrackingState", Context.MODE_PRIVATE)
            deviceId = prefs.getString("device_id", null)
            serverUrl = prefs.getString("server_url", null)
            android.util.Log.d("LocationService", "State restored: deviceId=$deviceId, serverUrl=$serverUrl")
        } catch (e: Exception) {
            android.util.Log.e("LocationService", "Failed to restore state: ${e.message}")
        }
    }
    
    /**
     * Clear tracking state from SharedPreferences
     */
    private fun clearStateFromPreferences() {
        try {
            val prefs = getSharedPreferences("LocationTrackingState", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putBoolean("is_tracking", false)
                remove("device_id")
                remove("server_url")
                apply()
            }
            android.util.Log.d("LocationService", "State cleared")
        } catch (e: Exception) {
            android.util.Log.e("LocationService", "Failed to clear state: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)
            
            // Check if channel already exists
            val existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existingChannel != null) {
                android.util.Log.d("LocationService", "Notification channel already exists")
                return
            }
            
            // Use DEFAULT importance to ensure notification is visible
            // LOW importance can hide notifications on some devices
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Shows when device location is being tracked"
                setShowBadge(false)
                enableLights(true)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                // Prevent user from blocking this channel
                setBypassDnd(false)
                // Make it important enough to stay visible
                importance = NotificationManager.IMPORTANCE_DEFAULT
            }
            notificationManager.createNotificationChannel(channel)
            android.util.Log.d("LocationService", "Notification channel created: $CHANNEL_ID")
        }
    }

    private fun startTracking() {
        if (isTracking) {
            android.util.Log.d("LocationService", "Already tracking, skipping")
            return
        }
        
        isTracking = true
        android.util.Log.d("LocationService", "Starting location tracking...")
        
        // Create notification channel first
        createNotificationChannel()
        
        // Start foreground service with notification
        // Note: Even if notifications are disabled, we must call startForeground()
        // The service will continue running, just without visible notification
        try {
            val notification = createNotification("Starting location tracking...")
            android.util.Log.d("LocationService", "Created notification, starting foreground...")
            
            // startForeground() is REQUIRED for foreground service
            // Service will continue even if notifications are disabled
            startForeground(NOTIFICATION_ID, notification)
            android.util.Log.d("LocationService", "✅ Foreground service started with notification ID: $NOTIFICATION_ID")
            
            // Try to post notification, but don't fail if notifications are disabled
            try {
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    if (notificationManager.areNotificationsEnabled()) {
                        notificationManager.notify(NOTIFICATION_ID, notification)
                        android.util.Log.d("LocationService", "Notification posted")
                    } else {
                        android.util.Log.w("LocationService", "⚠️ Notifications are disabled, but service will continue running")
                    }
                } else {
                    notificationManager.notify(NOTIFICATION_ID, notification)
                    android.util.Log.d("LocationService", "Notification posted (Android < N)")
                }
            } catch (e: Exception) {
                android.util.Log.w("LocationService", "⚠️ Could not post notification (may be disabled): ${e.message}")
                // Service continues running even if notification fails
            }
            
            // Schedule periodic notification check (every 30 seconds)
            // This ensures notification stays visible even if user dismisses it
            // But service continues even if notifications are disabled
            executor?.scheduleAtFixedRate({
                if (isTracking) {
                    ensureNotificationVisible()
                }
            }, 30, 30, TimeUnit.SECONDS)
            android.util.Log.d("LocationService", "Scheduled periodic notification check (every 30s)")
        } catch (e: Exception) {
            // Even if notification fails, try to continue service
            android.util.Log.e("LocationService", "❌ Error starting foreground: ${e.message}", e)
            
            // Try to start service without notification (may work on some devices)
            try {
                val notification = createNotification("Tracking location...")
                startForeground(NOTIFICATION_ID, notification)
                android.util.Log.d("LocationService", "Service started after retry")
            } catch (e2: Exception) {
                android.util.Log.e("LocationService", "❌ Failed to start service: ${e2.message}")
                // Only stop if we absolutely cannot start
                stopSelf()
                return
            }
        }
        
        // Request location updates
        try {
            val hasFineLocation = locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true
            val hasCoarseLocation = locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
            
            if (hasFineLocation || hasCoarseLocation) {
                // Prefer GPS provider for accuracy
                if (hasFineLocation) {
                    locationManager?.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        5000L, // 5 seconds
                        10f, // 10 meters minimum distance
                        this,
                        Looper.getMainLooper()
                    )
                }
                // Fallback to network if GPS not available
                if (hasCoarseLocation && !hasFineLocation) {
                    locationManager?.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        5000L,
                        10f,
                        this,
                        Looper.getMainLooper()
                    )
                }
            } else {
                android.util.Log.e("LocationService", "No location providers available")
                stopSelf()
            }
        } catch (e: SecurityException) {
            e.printStackTrace()
            stopSelf()
        }
    }

    private fun stopTracking() {
        if (!isTracking) return
        
        isTracking = false
        locationManager?.removeUpdates(this)
        executor?.shutdown()
    }

    override fun onLocationChanged(location: Location) {
        if (!isTracking) return
        
        // Filter by accuracy (only use good GPS fixes)
        if (location.accuracy > 50f) {
            return
        }
        
        // Only send if accuracy is good enough (30m threshold)
        if (location.accuracy <= 30f && deviceId != null && serverUrl != null) {
            lastLocation = location
            sendLocationToServer(location)
            updateNotification("Tracking location... (${String.format("%.1f", location.accuracy)}m)")
            
            // Periodically ensure notification is visible (every 10th location update)
            notificationCheckCounter++
            if (notificationCheckCounter >= 10) {
                notificationCheckCounter = 0
                ensureNotificationVisible()
            }
        }
    }

    private fun sendLocationToServer(location: Location) {
        executor?.execute {
            try {
                val url = "$serverUrl/api/location"
                val jsonBody = """
                    {
                        "deviceId": "$deviceId",
                        "latitude": ${location.latitude},
                        "longitude": ${location.longitude},
                        "accuracy": ${location.accuracy}
                    }
                """.trimIndent()
                
                val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                
                connection.outputStream.use { it.write(jsonBody.toByteArray()) }
                
                val responseCode = connection.responseCode
                if (responseCode in 200..299) {
                    android.util.Log.d("LocationService", "✅ Location sent successfully")
                    lastSuccessfulSendTime = System.currentTimeMillis()
                    consecutiveFailures = 0
                    saveHealthData("online")
                    updateNotification("Tracking... (${String.format("%.1f", location.accuracy)}m)")
                } else {
                    consecutiveFailures++
                    android.util.Log.e("LocationService", "❌ Failed to send location: $responseCode (failures: $consecutiveFailures)")
                    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                        saveHealthData("stale")
                        updateNotification("Tracking... (Connection issues)")
                    }
                }
                connection.disconnect()
            } catch (e: IOException) {
                consecutiveFailures++
                android.util.Log.e("LocationService", "❌ Network error: ${e.message} (failures: $consecutiveFailures)")
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    saveHealthData("stale")
                }
            } catch (e: Exception) {
                consecutiveFailures++
                android.util.Log.e("LocationService", "❌ Error: ${e.message} (failures: $consecutiveFailures)")
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    saveHealthData("stale")
                }
            }
        }
    }

    private fun createNotification(text: String): Notification {
        android.util.Log.d("LocationService", "Creating notification with text: $text")
        
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
        )

        // Use app icon - this is required and must be a valid resource
        val iconRes = try {
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            appInfo.icon
        } catch (e: Exception) {
            android.util.Log.w("LocationService", "Could not get app icon, using default: ${e.message}")
            // Use a valid system icon that works for notifications
            android.R.drawable.ic_menu_mylocation
        }

        android.util.Log.d("LocationService", "Using icon resource: $iconRes")

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Location Tracking Active")
            .setContentText(text)
            .setSmallIcon(iconRes)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // Prevents dismissal - CRITICAL
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setAutoCancel(false) // Don't auto-cancel
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(false)
            .setOnlyAlertOnce(true) // Don't alert on updates
            .build()
            
        android.util.Log.d("LocationService", "Notification created successfully")
        return notification
    }

    private fun updateNotification(text: String) {
        try {
            val notification = createNotification(text)
            
            // Always call startForeground() to keep service as foreground
            // This is required even if notifications are disabled
            startForeground(NOTIFICATION_ID, notification)
            
            // Try to update notification, but don't fail if disabled
            try {
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                
                // Check if notifications are enabled (Android 7.0+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    if (notificationManager.areNotificationsEnabled()) {
                        notificationManager.notify(NOTIFICATION_ID, notification)
                        android.util.Log.d("LocationService", "Notification updated: $text")
                    } else {
                        android.util.Log.d("LocationService", "Notifications disabled, but service continues: $text")
                    }
                } else {
                    // Android < 7.0, just try to notify
                    notificationManager.notify(NOTIFICATION_ID, notification)
                    android.util.Log.d("LocationService", "Notification updated: $text")
                }
            } catch (e: Exception) {
                // Notification update failed, but service continues
                android.util.Log.d("LocationService", "Could not update notification (may be disabled): ${e.message}")
            }
        } catch (e: Exception) {
            android.util.Log.w("LocationService", "Error in updateNotification: ${e.message}")
            // Service continues running even if notification update fails
        }
    }
    
    /**
     * Ensure notification is always visible
     * Called periodically to prevent accidental dismissal
     * Service continues running even if notifications are disabled
     */
    private fun ensureNotificationVisible() {
        if (isTracking) {
            try {
                val notification = createNotification("Tracking location...")
                
                // Always call startForeground() to maintain foreground service status
                // This is required even if notifications are disabled
                startForeground(NOTIFICATION_ID, notification)
                
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                
                // Check if notifications are enabled
                val notificationsEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    notificationManager.areNotificationsEnabled()
                } else {
                    true // Assume enabled on older Android
                }
                
                if (notificationsEnabled) {
                    // Check if our notification is still active
                    val activeNotifications = notificationManager.activeNotifications
                    val isNotificationActive = activeNotifications.any { it.id == NOTIFICATION_ID }
                    
                    if (!isNotificationActive) {
                        android.util.Log.w("LocationService", "⚠️ Notification was removed! Re-posting...")
                        notificationManager.notify(NOTIFICATION_ID, notification)
                        android.util.Log.d("LocationService", "✅ Notification re-posted")
                    } else {
                        android.util.Log.d("LocationService", "✅ Notification is still visible")
                    }
                } else {
                    android.util.Log.d("LocationService", "⚠️ Notifications disabled, but service continues running")
                    // Service continues even without visible notification
                }
            } catch (e: Exception) {
                android.util.Log.w("LocationService", "Error in ensureNotificationVisible: ${e.message}")
                // Service continues running even if notification check fails
                // Try to maintain foreground status
                try {
                    val notification = createNotification("Tracking location...")
                    startForeground(NOTIFICATION_ID, notification)
                } catch (e2: Exception) {
                    android.util.Log.w("LocationService", "Could not maintain foreground: ${e2.message}")
                    // Service may still continue, but might be downgraded to background
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        android.util.Log.d("LocationService", "Service onDestroy() called")
        stopTracking()
        saveHealthData("offline")
    }

    /**
     * Save health data to SharedPreferences for React Native access
     */
    private fun saveHealthData(status: String) {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                putLong(KEY_LAST_SUCCESS, lastSuccessfulSendTime)
                putString(KEY_STATUS, status)
                apply()
            }
            android.util.Log.d("LocationService", "Health data saved: status=$status, lastSuccess=$lastSuccessfulSendTime")
        } catch (e: Exception) {
            android.util.Log.e("LocationService", "Failed to save health data: ${e.message}")
        }
    }

    /**
     * Load health data from SharedPreferences
     */
    private fun loadHealthData() {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            lastSuccessfulSendTime = prefs.getLong(KEY_LAST_SUCCESS, 0)
            android.util.Log.d("LocationService", "Health data loaded: lastSuccess=$lastSuccessfulSendTime")
        } catch (e: Exception) {
            android.util.Log.e("LocationService", "Failed to load health data: ${e.message}")
        }
    }

    // LocationListener methods (unused but required)
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    companion object {
        const val ACTION_START = "com.devicetracker.START_TRACKING"
        const val ACTION_STOP = "com.devicetracker.STOP_TRACKING"
        const val EXTRA_DEVICE_ID = "device_id"
        const val EXTRA_SERVER_URL = "server_url"
    }
}

