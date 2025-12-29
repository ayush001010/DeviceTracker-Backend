// API configuration - no hardcoded values in routes

export const PAGINATION_CONFIG = {
  DEFAULT_LIMIT: 50, // default items per page
  MAX_LIMIT: 100, // maximum items per page
  MIN_LIMIT: 1, // minimum items per page
};

// Anti-theft detection configuration
export const DETECTION_CONFIG = {
  HISTORY_POINTS: 20, // Number of recent points to analyze
  IDLE_TIME_MS: 20 * 60 * 1000, // 20 minutes in milliseconds
  MOVE_DISTANCE_M: 30, // 30 meters - minimum distance to consider as movement
  MIN_MOVEMENT_DISTANCE_M: 5, // 5 meters - minimum distance to consider significant movement
};

