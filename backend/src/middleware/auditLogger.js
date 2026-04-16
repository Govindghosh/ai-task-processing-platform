import AuditLog from '../models/AuditLog.js';

const auditLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', async () => {
    // Ignore preflight CORS and health checks to avoid noise
    if (req.method === 'OPTIONS' || req.originalUrl === '/api/health') return;

    try {
      const responseTime = Date.now() - start;
      await AuditLog.create({
        // req.user might be populated by auth middleware
        userId: req.user ? req.user.id : null,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        statusCode: res.statusCode,
        responseTime,
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      });
    } catch (error) {
      console.error('Failed to write audit log to MongoDB:', error);
    }
  });

  next();
};

export default auditLogger;
