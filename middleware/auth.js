import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header must be: Bearer <token>',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.',
        });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.',
        });
      }
      throw err;
    }

    // Find user by ID from token
    const user = await User.findById(decoded.userId).select('-passwordHash').lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token is invalid.',
      });
    }

    // Attach user to request (includes deviceId)
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

/**
 * Optional JWT Authentication Middleware
 * Sets req.user if token is present, but doesn't fail if token is missing
 * Useful for routes that support both authenticated and unauthenticated access
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without setting req.user
      return next();
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      // Empty token - continue without setting req.user
      return next();
    }

    // Try to verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Invalid token - continue without setting req.user
      return next();
    }

    // Find user by ID from token
    const user = await User.findById(decoded.userId).select('-passwordHash').lean();

    if (user) {
      // Attach user to request (includes deviceId)
      req.user = user;
    }
    
    next();
  } catch (err) {
    // On error, continue without setting req.user
    console.error('Optional auth middleware error:', err);
    next();
  }
};

/**
 * Generate JWT token for user
 * Token does not expire (no expiration set)
 */
export const generateToken = (userId) => {
  return jwt.sign(
    {userId},
    JWT_SECRET,
    // No expiration - token is valid indefinitely
  );
};

export {JWT_SECRET};

