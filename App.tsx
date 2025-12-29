import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Alert,
  Linking,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  AppState,
  RefreshControl,
  Animated,
  Share,
} from 'react-native';
import Geolocation, {GeoCoordinates} from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import {v4 as uuidv4} from 'uuid';
import {SERVER_URL, GPS_CONFIG, WATCH_OPTIONS} from './config';
import LocationTrackingModule from './LocationTrackingModule';

// Queue configuration
const QUEUE_KEY = 'location_queue';
const MAX_QUEUE_SIZE = 100;

// Location payload type
type LocationPayload = {
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number; // When it was queued
};

// Queue helper functions
async function loadQueue(): Promise<LocationPayload[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.log('Error loading queue:', err);
    return [];
  }
}

async function saveQueue(queue: LocationPayload[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.log('Error saving queue:', err);
  }
}

async function enqueueLocation(payload: LocationPayload): Promise<void> {
  const queue = await loadQueue();
  
  // Avoid duplicates (same location within 1 second)
  const isDuplicate = queue.some(
    item =>
      item.deviceId === payload.deviceId &&
      item.latitude === payload.latitude &&
      item.longitude === payload.longitude &&
      Math.abs(item.timestamp - payload.timestamp) < 1000,
  );
  
  if (isDuplicate) {
    console.log('Skipping duplicate location in queue');
    return;
  }
  
  // Add to queue (FIFO - add to end)
  queue.push(payload);
  
  // Limit queue size (remove oldest if exceeded)
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.shift(); // Remove oldest item
    console.log(`Queue full, dropped oldest item. Current size: ${queue.length}`);
  }
  
  await saveQueue(queue);
  console.log(`📍 Location queued. Queue size: ${queue.length}`);
}

async function sendQueuedLocation(
  payload: LocationPayload,
): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/api/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: payload.deviceId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
      }),
    });
    
    if (response.ok) {
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Queued location send failed:', response.status, errorData);
      return false;
    }
  } catch (err) {
    console.log('❌ Queued location send error (network):', err);
    return false;
  }
}

async function flushQueue(): Promise<void> {
  const queue = await loadQueue();
  
  if (queue.length === 0) {
    return;
  }
  
  console.log(`🔄 Flushing queue: ${queue.length} items`);
  
  // Process queue one by one (FIFO - process from start)
  const remainingQueue: LocationPayload[] = [];
  
  for (const item of queue) {
    const success = await sendQueuedLocation(item);
    
    if (success) {
      console.log(`✅ Queued location sent: ${item.timestamp}`);
      // Don't add to remainingQueue - it's successfully sent
    } else {
      // Network still down, keep in queue
      remainingQueue.push(item);
      // Stop retrying if one fails (network is still down)
      console.log('⏸️ Stopping queue flush - network still unavailable');
      break;
    }
  }
  
  // Save remaining items
  if (remainingQueue.length !== queue.length) {
    await saveQueue(remainingQueue);
    console.log(`📦 Queue updated: ${remainingQueue.length} items remaining`);
  }
}

export default function App() {
  const [location, setLocation] = useState<GeoCoordinates | null>(null);
  const [previousLocation, setPreviousLocation] =
    useState<GeoCoordinates | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [speed, setSpeed] = useState<number | null>(null);
  const [status, setStatus] = useState<'Moving' | 'Stationary'>('Stationary');
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isBackgroundTracking, setIsBackgroundTracking] = useState(false);
  const watchId = useRef<number | null>(null);
  const autoRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshIconRotation = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(50)).current;

  async function getOrCreateDeviceId() {
    const key = 'device_id';
    try {
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        return existing;
      }
      const nextId = uuidv4();
      await AsyncStorage.setItem(key, nextId);
      return nextId;
    } catch (err) {
      console.log('device id error', err);
      return uuidv4();
    }
  }

  // Request background location permission (Android 10+)
  async function requestBackgroundLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    // Only needed for Android 10+ (API 29+)
    if (Platform.Version < 29) {
      return true;
    }

    try {
      // Use string constant directly (may not be in PermissionsAndroid.PERMISSIONS)
      const backgroundPermission = 'android.permission.ACCESS_BACKGROUND_LOCATION';

      // Check if already granted
      const alreadyGranted = await PermissionsAndroid.check(backgroundPermission);
      if (alreadyGranted) {
        return true;
      }

      // Check if foreground location is granted first
      const fineLocation = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const fineGranted = await PermissionsAndroid.check(fineLocation);
      
      if (!fineGranted) {
        Alert.alert(
          'Permission Needed',
          'Please grant location permission first, then we can enable background tracking.',
          [{text: 'OK'}],
        );
        return false;
      }

      // Android 11+ (API 30+) requires manual settings change
      if (Platform.Version >= 30) {
        Alert.alert(
          'Background Location Required',
          'To enable background tracking, please:\n\n1. Tap "Open Settings" below\n2. Go to Permissions → Location\n3. Select "Allow all the time"\n\nThis is required for tracking when the app is closed.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        );
        return false;
      }

      // Android 10 (API 29) - can request programmatically
      const result = await PermissionsAndroid.request(
        backgroundPermission,
        {
          title: 'Background Location Permission',
          message:
            'Mee needs access to your location even when the app is closed to track your device in the background. Please select "Allow all the time".',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        },
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permission Required',
          'Background location permission is required. Please enable it in Settings → Apps → Mee → Permissions → Location → Allow all the time',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        );
      } else {
        Alert.alert(
          'Permission Needed',
          'Please select "Allow all the time" (not "While using the app") for background tracking to work.',
          [{text: 'OK'}],
        );
      }

      return false;
    } catch (error) {
      console.error('Error requesting background location permission:', error);
      // If request fails, direct user to settings
      Alert.alert(
        'Permission Required',
        'Please enable background location in Settings → Apps → Mee → Permissions → Location → Allow all the time',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ],
      );
      return false;
    }
  }

  // Background tracking functions
  async function startBackgroundTracking() {
    try {
      if (!deviceId) {
        Alert.alert('Error', 'Device ID not loaded');
        return;
      }

      if (Platform.OS !== 'android') {
        Alert.alert('Not Supported', 'Background tracking is only available on Android');
        return;
      }

      // Request background location permission first (Android 10+)
      const hasBackgroundPermission = await requestBackgroundLocationPermission();
      if (!hasBackgroundPermission) {
        return; // User denied or needs to grant in settings
      }

      await LocationTrackingModule.startTracking(deviceId, SERVER_URL);
      setIsBackgroundTracking(true);
      Alert.alert('Success', 'Background tracking started. Location will continue even when app is closed.');
    } catch (error: any) {
      console.error('Failed to start background tracking:', error);
      Alert.alert('Error', error.message || 'Failed to start background tracking');
    }
  }

  async function stopBackgroundTracking() {
    try {
      if (Platform.OS !== 'android') {
        return;
      }

      await LocationTrackingModule.stopTracking();
      setIsBackgroundTracking(false);
      Alert.alert('Success', 'Background tracking stopped');
    } catch (error: any) {
      console.error('Failed to stop background tracking:', error);
      Alert.alert('Error', error.message || 'Failed to stop background tracking');
    }
  }

  function haversineDistance(from: GeoCoordinates, to: GeoCoordinates) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(to.latitude - from.latitude);
    const dLon = toRad(to.longitude - from.longitude);
    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.asin(Math.sqrt(a));
    return R * c;
  }

  async function sendLocationUpdate({
    deviceId,
    latitude,
    longitude,
    accuracy,
  }: {
    deviceId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
  }) {
    // Try to flush queue before sending new location
    await flushQueue();
    
    try {
      const response = await fetch(`${SERVER_URL}/api/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          latitude,
          longitude,
          accuracy,
        }),
      });
      
      if (response.ok) {
        console.log('✅ Location sent successfully');
      } else {
        // Server error (4xx, 5xx) - queue it
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ Location send failed:', response.status, errorData);
        
        await enqueueLocation({
          deviceId,
          latitude,
          longitude,
          accuracy,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      // Network error - queue it
      console.log('❌ Location send error (network):', err);
      
      await enqueueLocation({
        deviceId,
        latitude,
        longitude,
        accuracy,
        timestamp: Date.now(),
      });
    }
  }

  useEffect(() => {
    (async () => {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      
      // Flush queue on app start
      await flushQueue();

      // Check background tracking status (Android only)
      if (Platform.OS === 'android') {
        try {
          const isActive = await LocationTrackingModule.isTracking();
          setIsBackgroundTracking(isActive);
        } catch (err) {
          console.log('Error checking background tracking status:', err);
        }
      }
    })();
  }, []);

  // Listen for app state changes to flush queue when app becomes active
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // App came to foreground - try to flush queue
        flushQueue().catch(err => {
          console.log('Error flushing queue on app resume:', err);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(async (isManual: boolean = true) => {
    if (refreshing || !deviceId) return;

    setRefreshing(true);
    setLastRefresh(new Date());

    try {
      // Flush queue first
      await flushQueue();

      // Force location update by getting current position
      Geolocation.getCurrentPosition(
        position => {
          const coords = position.coords;
          if (
            typeof coords.accuracy !== 'number' ||
            coords.accuracy <= GPS_CONFIG.ACCURACY_SEND_THRESHOLD_M
          ) {
            void sendLocationUpdate({
              deviceId,
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
            });
          }
          setLocation(coords);
          setRefreshing(false);
        },
        err => {
          console.log('Refresh location error:', err);
          setRefreshing(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Force fresh location
        },
      );
    } catch (err) {
      console.log('Refresh error:', err);
      setRefreshing(false);
    }
  }, [refreshing, deviceId]);

  // Auto-refresh interval (every 30 seconds)
  useEffect(() => {
    if (deviceId && location) {
      autoRefreshInterval.current = setInterval(() => {
        handleRefresh(false);
      }, 30000); // 30 seconds
    }

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [deviceId, location, handleRefresh]);

  // Animate refresh icon
  useEffect(() => {
    if (refreshing) {
      const animation = Animated.loop(
        Animated.timing(refreshIconRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      animation.start();
      return () => animation.stop();
    } else {
      refreshIconRotation.setValue(0);
    }
  }, [refreshing, refreshIconRotation]);


  // Format last refresh time
  const formatLastRefresh = () => {
    if (!lastRefresh) return null;
    const now = new Date();
    const diff = now.getTime() - lastRefresh.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) {
      return `${seconds}s ago`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    } else {
      return lastRefresh.toLocaleTimeString();
    }
  };

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    let cancelled = false;

    async function ensureLocationPermission() {
      if (Platform.OS !== 'android') {
        return true;
      }

      const alreadyGranted =
        (await PermissionsAndroid.check(fine)) ||
        (await PermissionsAndroid.check(coarse));
      if (alreadyGranted) {
        return true;
      }

      const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
      const fineResult = result[fine];
      const coarseResult = result[coarse];
      const granted =
        fineResult === PermissionsAndroid.RESULTS.GRANTED ||
        coarseResult === PermissionsAndroid.RESULTS.GRANTED;
      const neverAskAgain =
        fineResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        coarseResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      if (granted) {
        return true;
      }

      if (neverAskAgain && !cancelled) {
        Alert.alert(
          'Permission needed',
          'Location is blocked. Enable it in system settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Open Settings', onPress: () => Linking.openSettings()},
          ],
        );
      }

      return false;
    }

    function startWatchingLocation() {
      watchId.current = Geolocation.watchPosition(
        position => {
          if (cancelled) {
            return;
          }
          const coords = position.coords;
          const accuracyOk =
            typeof coords.accuracy !== 'number' || coords.accuracy <= GPS_CONFIG.ACCURACY_MAX_M;
          const speedMs = typeof coords.speed === 'number' ? coords.speed : 0;

          setPreviousLocation(prev => {
            if (prev && accuracyOk) {
              const delta = haversineDistance(prev, coords);
              const moving =
                speedMs >= GPS_CONFIG.SPEED_THRESHOLD_MS || delta >= GPS_CONFIG.DISTANCE_THRESHOLD_M;
              if (moving) {
                setStatus('Moving');
              } else {
                setStatus('Stationary');
              }
              setTotalDistance(distance => distance + delta);
            } else if (prev && !accuracyOk) {
              setStatus('Stationary');
            }
            return coords;
          });

          if (accuracyOk) {
            setSpeed(speedMs);
            setError(null);
            if (
              typeof coords.accuracy !== 'number' ||
              coords.accuracy <= GPS_CONFIG.ACCURACY_SEND_THRESHOLD_M
            ) {
              if (deviceId) {
                void sendLocationUpdate({
                  deviceId,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracy: coords.accuracy,
                });
              }
            }
          } else {
            setSpeed(speedMs);
            setError('Waiting for better GPS accuracy...');
          }

          setLocation(position.coords);
        },
        err => {
          if (cancelled) {
            return;
          }
          setError(err.message);
        },
        WATCH_OPTIONS,
      );
    }

    async function requestPermissionAndGetLocation() {
      const allowed = await ensureLocationPermission();
      if (allowed && !cancelled) {
        startWatchingLocation();
      } else if (!allowed && !cancelled) {
        setError('Location permission denied');
      }
    }

    requestPermissionAndGetLocation();

    return () => {
      cancelled = true;
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        Geolocation.stopObserving();
      }
    };
  }, [deviceId]);

  const showSettingsButton =
    error?.toLowerCase().includes('blocked') ||
    error?.toLowerCase().includes('denied');

  const statusColor = status === 'Moving' ? '#10B981' : '#6B7280';
  const speedKmh = ((speed ?? 0) * 3.6).toFixed(1);

  const copyDeviceId = useCallback(async () => {
    if (deviceId) {
      try {
        // Use Share API which is built-in and doesn't require native linking
        await Share.share({
          message: deviceId,
          title: 'Device ID',
        });
        
        // Show toast notification
        setShowToast(true);
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(toastTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
        ]).start();

        // Hide toast after 3 seconds
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(toastOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(toastTranslateY, {
              toValue: 50,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShowToast(false);
          });
        }, 3000);
      } catch (error) {
        // If share fails, show device ID in alert as fallback
        Alert.alert('Device ID', deviceId, [{text: 'OK'}]);
      }
    }
  }, [deviceId, toastOpacity, toastTranslateY]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => handleRefresh(true)}
            tintColor="#60A5FA"
            colors={['#60A5FA']}
            progressBackgroundColor="#1E293B"
          />
        }>
        {location ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Text style={styles.title}>Mee</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {backgroundColor: statusColor + '20'},
                  ]}>
                  <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
                  <Text style={[styles.statusText, {color: statusColor}]}>
                    {status}
                  </Text>
                </View>
              </View>
              {lastRefresh && (
                <View style={styles.refreshIndicator}>
                  <Animated.View
                    style={[
                      styles.refreshIconContainer,
                      {
                        transform: [
                          {
                            rotate: refreshIconRotation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      },
                    ]}>
                    <View style={styles.refreshIconCircle}>
                      <View style={styles.refreshIconArrow} />
                    </View>
                  </Animated.View>
                  <Text style={styles.refreshText}>
                    Updated {formatLastRefresh()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>📍</Text>
                <Text style={styles.cardTitle}>Location</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Latitude</Text>
                  <Text style={styles.infoValue}>
                    {location.latitude.toFixed(6)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Longitude</Text>
                  <Text style={styles.infoValue}>
                    {location.longitude.toFixed(6)}
                  </Text>
                </View>
                {location.accuracy && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Accuracy</Text>
                      <Text style={styles.infoValue}>
                        {location.accuracy.toFixed(1)} m
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>⚡</Text>
                <Text style={styles.cardTitle}>Speed</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.speedContainer}>
                  <Text style={styles.speedValue}>{speedKmh}</Text>
                  <Text style={styles.speedUnit}>km/h</Text>
                </View>
                <Text style={styles.speedSecondary}>
                  {(speed ?? 0).toFixed(2)} m/s
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>📏</Text>
                <Text style={styles.cardTitle}>Distance</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.distanceContainer}>
                  <Text style={styles.distanceValue}>
                    {(totalDistance / 1000).toFixed(3)}
                  </Text>
                  <Text style={styles.distanceUnit}>km</Text>
                </View>
                <Text style={styles.distanceSecondary}>
                  {totalDistance.toFixed(1)} meters
                </Text>
              </View>
            </View>

            {deviceId && (
              <View style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <Text style={styles.deviceLabel}>Device ID</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={copyDeviceId}
                    activeOpacity={0.7}>
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.deviceValue} selectable>
                  {deviceId.substring(0, 9)}-xxxxxx
                </Text>
              </View>
            )}

            {Platform.OS === 'android' && deviceId && (
              <View style={styles.backgroundTrackingCard}>
                <View style={styles.backgroundTrackingHeader}>
                  <Text style={styles.backgroundTrackingIcon}>
                    {isBackgroundTracking ? '🟢' : '⚪'}
                  </Text>
                  <Text style={styles.backgroundTrackingTitle}>
                    Background Tracking
                  </Text>
                </View>
                <Text style={styles.backgroundTrackingDescription}>
                  {isBackgroundTracking
                    ? 'Location tracking continues when app is closed or phone is locked'
                    : 'Enable to track location even when app is minimized'}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.backgroundTrackingButton,
                    isBackgroundTracking && styles.backgroundTrackingButtonActive,
                  ]}
                  onPress={
                    isBackgroundTracking
                      ? stopBackgroundTracking
                      : startBackgroundTracking
                  }
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.backgroundTrackingButtonText,
                      isBackgroundTracking &&
                        styles.backgroundTrackingButtonTextActive,
                    ]}>
                    {isBackgroundTracking
                      ? 'Stop Background Tracking'
                      : 'Start Background Tracking'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingIcon}>🛰️</Text>
            <Text style={styles.loadingText}>
              {error || 'Requesting location...'}
            </Text>
            {showSettingsButton && (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => Linking.openSettings()}>
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Toast Notification */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{translateY: toastTranslateY}],
            },
          ]}>
          <View style={styles.toastContent}>
            <View style={styles.toastIcon}>
              <Text style={styles.toastCheckmark}>✓</Text>
            </View>
            <Text style={styles.toastMessage}>Device ID copied!</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  refreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  refreshIconContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconArrow: {
    position: 'absolute',
    top: -2,
    right: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderLeftColor: '#60A5FA',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    transform: [{rotate: '-45deg'}],
  },
  refreshText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  cardContent: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  speedContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  speedValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#60A5FA',
    marginRight: 8,
  },
  speedUnit: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '500',
  },
  speedSecondary: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  distanceValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#34D399',
    marginRight: 8,
  },
  distanceUnit: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '500',
  },
  distanceSecondary: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  deviceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  copyButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  deviceValue: {
    fontSize: 13,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toastIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastCheckmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  toastMessage: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  loadingIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backgroundTrackingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backgroundTrackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  backgroundTrackingIcon: {
    fontSize: 16,
  },
  backgroundTrackingTitle: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  backgroundTrackingDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    lineHeight: 18,
  },
  backgroundTrackingButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  backgroundTrackingButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  backgroundTrackingButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  backgroundTrackingButtonTextActive: {
    color: '#FFFFFF',
  },
});
