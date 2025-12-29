// App configuration - easily changeable values (no hardcoding in components)

// Server configuration
// Change these values to match your setup
export const SERVER_HOST = '192.168.1.11'; // Your server IP address
export const SERVER_PORT = '4000'; // Your server port
export const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// GPS tracking thresholds (configurable)
export const GPS_CONFIG = {
  SPEED_THRESHOLD_MS: 0.5, // m/s - minimum speed to consider "moving"
  DISTANCE_THRESHOLD_M: 5, // meters - minimum distance change to consider "moving"
  ACCURACY_MAX_M: 50, // ignore GPS fixes worse than this
  ACCURACY_SEND_THRESHOLD_M: 30, // only send to server when accuracy is this good or better
};

// Geolocation watch options
export const WATCH_OPTIONS = {
  enableHighAccuracy: true,
  distanceFilter: 10, // meters
  interval: 5000, // ms
  fastestInterval: 2000, // ms
  forceRequestLocation: true,
  showLocationDialog: true,
};
