import express from 'express';
import AuditLog from '../models/AuditLog.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get usage logs (Latest 100)
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find()
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch usage logs' });
  }
});

// Get aggregate stats
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await AuditLog.aggregate([
      {
        $group: {
          _id: "$method",
          count: { $sum: 1 },
          avgResponseTime: { $avg: "$responseTime" }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch usage stats' });
  }
});

export default router;
