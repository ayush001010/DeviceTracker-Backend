import {Router} from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import {generateToken, authenticate} from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user with email, username, password, and deviceId
 */
router.post('/register', async (req, res) => {
  try {
    const {email, username, password, deviceId} = req.body;

    // Validate required fields
    if (!email || !username || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: email, username, password, deviceId',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Validate username (alphanumeric + underscore, 3-30 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-30 characters, alphanumeric and underscores only',
      });
    }

    // Validate password (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Validate deviceId format (UUID-like)
    if (typeof deviceId !== 'string' || deviceId.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deviceId format',
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({email: email.toLowerCase()});
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({username});
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
      });
    }

    // Check if deviceId already exists (device already registered)
    const existingDevice = await User.findOne({deviceId});
    if (existingDevice) {
      return res.status(409).json({
        success: false,
        message: 'This device is already registered to another account',
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user (atomic operation)
    let user;
    try {
      user = await User.create({
        email: email.toLowerCase(),
        username,
        passwordHash,
        deviceId,
      });
    } catch (createError) {
      // Handle duplicate key errors (race condition)
      if (createError.code === 11000) {
        const field = Object.keys(createError.keyPattern)[0];
        return res.status(409).json({
          success: false,
          message: `${field} already exists`,
        });
      }
      throw createError;
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

    // Return success response (exclude passwordHash)
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          deviceId: user.deviceId,
        },
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 * Returns JWT token and deviceId (from user record)
 */
router.post('/login', async (req, res) => {
  try {
    const {username, password} = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    // Find user by username
    const user = await User.findOne({username}).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

    // Return success response
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          deviceId: user.deviceId,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
});

/**
 * GET /api/auth/check-username?username=xyz
 * Check if username is available (read-only, safe)
 */
router.get('/check-username', async (req, res) => {
  try {
    const {username} = req.query;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Username parameter is required',
      });
    }

    const trimmedUsername = username.trim();

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return res.json({
        success: true,
        available: false,
        message: 'Username must be 3-30 characters, alphanumeric and underscores only',
      });
    }

    // Check if username exists
    const existing = await User.findOne({username: trimmedUsername});

    return res.json({
      success: true,
      available: !existing,
    });
  } catch (err) {
    console.error('Check username error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error checking username availability',
    });
  }
});

/**
 * GET /api/auth/check-email?email=abc@email.com
 * Check if email exists (read-only, safe)
 */
router.get('/check-email', async (req, res) => {
  try {
    const {email} = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.json({
        success: true,
        exists: false,
        message: 'Invalid email format',
      });
    }

    // Check if email exists
    const existing = await User.findOne({email: trimmedEmail});

    return res.json({
      success: true,
      exists: !!existing,
    });
  } catch (err) {
    console.error('Check email error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error checking email existence',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (protected route)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        id: req.user._id,
        email: req.user.email,
        username: req.user.username,
        deviceId: req.user.deviceId,
      },
    });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user info',
    });
  }
});

export default router;

