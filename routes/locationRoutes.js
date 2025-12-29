import {Router} from 'express';
import Location from '../models/Location.js';
import {PAGINATION_CONFIG, DETECTION_CONFIG} from '../config/apiConfig.js';

const router = Router();

/**
 * POST /api/location
 * Submit location update (no authentication required)
 */
router.post('/location', async (req, res) => {
  try {
    // Get deviceId from request body
    const {deviceId, latitude, longitude, accuracy} = req.body || {};
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required in request body',
      });
    }
    
    console.log('📥 Received location update:', {deviceId, latitude, longitude, accuracy});

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number'
    ) {
      console.log('❌ Validation failed:', {latitude, longitude});
      return res
        .status(400)
        .json({success: false, message: 'latitude and longitude (numbers) are required'});
    }

    const doc = await Location.create({deviceId, latitude, longitude, accuracy});
    console.log('✅ Location saved to DB:', doc._id);
    return res.status(201).json({success: true, data: doc});
  } catch (err) {
    console.error('❌ POST /location error', err);
    return res.status(500).json({success: false, message: 'Server error'});
  }
});

/**
 * GET /api/location/latest
 * Get latest location for device (no authentication required)
 */
router.get('/location/latest', async (req, res) => {
  try {
    // Get deviceId from query parameter
    const deviceId = req.query.deviceId;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required as query parameter',
      });
    }

    const latest = await Location.findOne({deviceId})
      .sort({createdAt: -1})
      .lean();

    if (!latest) {
      return res
        .status(404)
        .json({success: false, message: 'No location found'});
    }

    return res.json({success: true, data: latest});
  } catch (err) {
    console.error('GET /location/latest error', err);
    return res.status(500).json({success: false, message: 'Server error'});
  }
});

/**
 * GET /api/location/history
 * Get location history for device (no authentication required)
 */
router.get('/location/history', async (req, res) => {
  try {
    // Get deviceId from query parameter
    const deviceId = req.query.deviceId;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required as query parameter',
      });
    }
    
    console.log('📜 History request for deviceId:', deviceId);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      PAGINATION_CONFIG.MAX_LIMIT,
      Math.max(
        PAGINATION_CONFIG.MIN_LIMIT,
        parseInt(req.query.limit) || PAGINATION_CONFIG.DEFAULT_LIMIT,
      ),
    );
    const skip = (page - 1) * limit;

    // Count total documents for this device
    const total = await Location.countDocuments({deviceId});

    if (total === 0) {
      return res.status(404).json({
        success: false,
        message: `No location history found for deviceId: ${deviceId}`,
      });
    }

    // Fetch paginated locations
    const points = await Location.find({deviceId})
      .sort({createdAt: -1})
      .skip(skip)
      .limit(limit)
      .select('latitude longitude accuracy createdAt')
      .lean();

    return res.json({
      success: true,
      data: {
        deviceId,
        page,
        limit,
        total,
        points: points.map(point => ({
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          createdAt: point.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error('GET /location/history error', err);
    return res.status(500).json({success: false, message: 'Server error'});
  }
});

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Detect suspicious movement patterns
 * Logic: If device was idle for longer than IDLE_TIME_MS
 *        and then moves more than MOVE_DISTANCE_M, mark as SUSPICIOUS
 */
/**
 * GET /api/device/status
 * Get device status for device (no authentication required)
 */
router.get('/device/status', async (req, res) => {
  try {
    // Get deviceId from query parameter
    const deviceId = req.query.deviceId;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required as query parameter',
      });
    }
    
    console.log('🔍 Status check for deviceId:', deviceId);

    // Fetch recent location history (last N points)
    const points = await Location.find({deviceId})
      .sort({createdAt: -1})
      .limit(DETECTION_CONFIG.HISTORY_POINTS)
      .select('latitude longitude accuracy createdAt')
      .lean();

    if (points.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No location data found for deviceId: ${deviceId}`,
      });
    }

    // Reverse to get chronological order (oldest to newest)
    const chronologicalPoints = points.reverse();
    const now = new Date();
    const lastSeen = new Date(chronologicalPoints[chronologicalPoints.length - 1].createdAt);

    // Find the last significant movement time
    // Movement is considered when distance between consecutive points > MIN_MOVEMENT_DISTANCE_M
    let lastMovementTime = null;
    let lastMovementDistance = 0;

    for (let i = 1; i < chronologicalPoints.length; i++) {
      const prev = chronologicalPoints[i - 1];
      const curr = chronologicalPoints[i];

      const distance = haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude,
      );

      // If movement is significant, update last movement time
      if (distance >= DETECTION_CONFIG.MIN_MOVEMENT_DISTANCE_M) {
        lastMovementTime = new Date(curr.createdAt);
        lastMovementDistance = distance;
      }
    }

    // If no movement detected, use the first point's time
    if (!lastMovementTime) {
      lastMovementTime = new Date(chronologicalPoints[0].createdAt);
    }

    // Calculate time since last movement
    const timeSinceLastMovement = now.getTime() - lastMovementTime.getTime();

    // Check for suspicious pattern:
    // 1. Device was idle for longer than IDLE_TIME_MS
    // 2. Then moved more than MOVE_DISTANCE_M
    let status = 'OK';
    let reason = null;

    // Check if there was a long idle period before recent movement
    if (chronologicalPoints.length >= 2) {
      // Get the most recent movement (last two points)
      const recentPoint = chronologicalPoints[chronologicalPoints.length - 1];
      const previousPoint = chronologicalPoints[chronologicalPoints.length - 2];

      const recentDistance = haversineDistance(
        previousPoint.latitude,
        previousPoint.longitude,
        recentPoint.latitude,
        recentPoint.longitude,
      );

      // Check if recent movement is significant
      if (recentDistance >= DETECTION_CONFIG.MOVE_DISTANCE_M) {
        // Check if there was a long idle period before this movement
        const timeBetweenPoints =
          new Date(recentPoint.createdAt).getTime() -
          new Date(previousPoint.createdAt).getTime();

        // If there was a gap longer than IDLE_TIME_MS before significant movement
        if (timeBetweenPoints >= DETECTION_CONFIG.IDLE_TIME_MS) {
          status = 'SUSPICIOUS';
          reason = `Device was idle for ${Math.round(
            timeBetweenPoints / 60000,
          )} minutes, then moved ${recentDistance.toFixed(1)} meters`;
        }
      }
    }

    // Alternative check: If device hasn't moved in a long time but suddenly appears far away
    // (This handles cases where device might have been moved while offline)
    if (status === 'OK' && timeSinceLastMovement >= DETECTION_CONFIG.IDLE_TIME_MS) {
      // Check if the most recent point is far from the previous known location
      if (chronologicalPoints.length >= 2) {
        const mostRecent = chronologicalPoints[chronologicalPoints.length - 1];
        const beforeIdle = chronologicalPoints[0]; // First point in our sample

        const totalDistance = haversineDistance(
          beforeIdle.latitude,
          beforeIdle.longitude,
          mostRecent.latitude,
          mostRecent.longitude,
        );

        // If device moved a significant distance after being idle
        if (totalDistance >= DETECTION_CONFIG.MOVE_DISTANCE_M) {
          status = 'SUSPICIOUS';
          reason = `Device was idle for ${Math.round(
            timeSinceLastMovement / 60000,
          )} minutes, then appeared ${totalDistance.toFixed(1)} meters away`;
        }
      }
    }

    console.log(`📊 Device status: ${status}`, {
      deviceId,
      lastSeen,
      lastMovement: lastMovementTime,
      reason,
    });

    return res.json({
      success: true,
      data: {
        deviceId,
        status,
        reason,
        lastSeen,
        lastMovement: lastMovementTime,
      },
    });
  } catch (err) {
    console.error('❌ GET /device/status error', err);
    return res.status(500).json({success: false, message: 'Server error'});
  }
});

export default router;

