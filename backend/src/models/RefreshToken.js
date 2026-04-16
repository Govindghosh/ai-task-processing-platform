import mongoose from 'mongoose';
import crypto from 'crypto';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    family: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL — auto-deletes expired tokens
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    replacedBy: {
      type: String,
      default: null,
    },
    deviceInfo: {
      type: String,
      default: 'unknown',
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookups
refreshTokenSchema.index({ userId: 1, family: 1 });

/**
 * Hash a raw refresh token for secure storage.
 * We never store raw tokens — only SHA-256 hashes.
 */
refreshTokenSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Generate a cryptographically secure random token.
 */
refreshTokenSchema.statics.generateToken = function () {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Generate a unique token family ID.
 * A family groups all tokens in a rotation chain.
 */
refreshTokenSchema.statics.generateFamily = function () {
  return crypto.randomBytes(20).toString('hex');
};

/**
 * Create and store a new refresh token.
 */
refreshTokenSchema.statics.createToken = async function (userId, family, deviceInfo, ipAddress) {
  const rawToken = this.generateToken();
  const tokenHash = this.hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10));

  await this.create({
    userId,
    tokenHash,
    family: family || this.generateFamily(),
    expiresAt,
    deviceInfo: deviceInfo || 'unknown',
    ipAddress: ipAddress || null,
  });

  return {
    rawToken,
    family: family || tokenHash,
    expiresAt,
  };
};

/**
 * Revoke all tokens in a family (theft detection).
 */
refreshTokenSchema.statics.revokeFamily = async function (family) {
  await this.deleteMany({ family });
};

/**
 * Revoke all tokens for a user (logout all devices).
 */
refreshTokenSchema.statics.revokeAllForUser = async function (userId) {
  await this.deleteMany({ userId });
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
