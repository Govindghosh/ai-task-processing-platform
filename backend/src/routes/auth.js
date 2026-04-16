import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// ---------------------
// Token Helpers
// ---------------------

/**
 * Generate a short-lived access token (15 minutes).
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m' }
  );
};

/**
 * Issue both access + refresh tokens.
 * Refresh token is stored hashed in MongoDB.
 */
const issueTokenPair = async (userId, family, deviceInfo, ipAddress) => {
  const accessToken = generateAccessToken(userId);

  const tokenFamily = family || RefreshToken.generateFamily();
  const { rawToken: refreshToken, expiresAt } = await RefreshToken.createToken(
    userId,
    tokenFamily,
    deviceInfo,
    ipAddress
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiry: expiresAt,
    tokenFamily,
  };
};

/**
 * Extract device info from request headers.
 */
const getDeviceInfo = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Extract IP address from request.
 */
const getIpAddress = (req) => {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
};

// -----------------------------------------------
// POST /api/auth/register
// -----------------------------------------------
router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }

      const { name, email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists',
        });
      }

      const user = await User.create({ name, email, password });

      const tokens = await issueTokenPair(
        user._id,
        null,
        getDeviceInfo(req),
        getIpAddress(req)
      );

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create account',
      });
    }
  }
);

// -----------------------------------------------
// POST /api/auth/login
// -----------------------------------------------
router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      const tokens = await issueTokenPair(
        user._id,
        null,
        getDeviceInfo(req),
        getIpAddress(req)
      );

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
      });
    }
  }
);

// -----------------------------------------------
// POST /api/auth/refresh — Rotate refresh token
// -----------------------------------------------
router.post(
  '/refresh',
  [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
      }

      const { refreshToken } = req.body;
      const tokenHash = RefreshToken.hashToken(refreshToken);

      const storedToken = await RefreshToken.findOne({ tokenHash });

      if (!storedToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
        });
      }

      if (storedToken.expiresAt < new Date()) {
        await RefreshToken.deleteOne({ _id: storedToken._id });
        return res.status(401).json({
          success: false,
          message: 'Refresh token has expired. Please login again.',
        });
      }

      // Reuse detection — revoke entire family
      if (storedToken.isUsed) {
        console.warn(
          `⚠️ Refresh token reuse detected for user ${storedToken.userId}. ` +
          `Revoking token family: ${storedToken.family}`
        );
        await RefreshToken.revokeFamily(storedToken.family);
        return res.status(401).json({
          success: false,
          message: 'Token reuse detected. All sessions revoked for security. Please login again.',
        });
      }

      storedToken.isUsed = true;
      await storedToken.save();

      const user = await User.findById(storedToken.userId);
      if (!user) {
        await RefreshToken.revokeFamily(storedToken.family);
        return res.status(401).json({
          success: false,
          message: 'User account no longer exists',
        });
      }

      const tokens = await issueTokenPair(
        user._id,
        storedToken.family,
        getDeviceInfo(req),
        getIpAddress(req)
      );

      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh tokens',
      });
    }
  }
);

// -----------------------------------------------
// POST /api/auth/logout
// -----------------------------------------------
router.post(
  '/logout',
  [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required'),
  ],
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        const tokenHash = RefreshToken.hashToken(refreshToken);
        const storedToken = await RefreshToken.findOne({ tokenHash });

        if (storedToken) {
          await RefreshToken.revokeFamily(storedToken.family);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
      });
    }
  }
);

// -----------------------------------------------
// POST /api/auth/logout-all
// -----------------------------------------------
router.post('/logout-all', auth, async (req, res) => {
  try {
    await RefreshToken.revokeAllForUser(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully',
    });
  } catch (error) {
    console.error('Logout-all error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout from all devices',
    });
  }
});

// -----------------------------------------------
// GET /api/auth/me
// -----------------------------------------------
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const activeSessions = await RefreshToken.countDocuments({
      userId: user._id,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        activeSessions,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
    });
  }
});

export default router;
