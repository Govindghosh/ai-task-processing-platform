import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Task, { OPERATIONS } from '../models/Task.js';
import auth from '../middleware/auth.js';
import { addTaskJob } from '../queues/taskQueue.js';

const router = express.Router();

// All task routes require authentication
router.use(auth);

// -----------------------------------------------
// GET /api/tasks — List user's tasks (paginated)
// -----------------------------------------------
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['pending', 'running', 'success', 'failed']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }

      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const skip = (page - 1) * limit;

      const filter = { userId: req.user.id };
      if (req.query.status) {
        filter.status = req.query.status;
      }

      const [tasks, total] = await Promise.all([
        Task.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-logs')
          .lean(),
        Task.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: {
          tasks,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('List tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tasks',
      });
    }
  }
);

// -----------------------------------------------
// GET /api/tasks/stats — Task statistics
// -----------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const stats = await Task.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      total: 0,
    };

    stats.forEach((s) => {
      result[s._id] = s.count;
      result.total += s.count;
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task statistics',
    });
  }
});

// -----------------------------------------------
// GET /api/tasks/:id — Get single task with logs
// -----------------------------------------------
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid task ID'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid task ID',
        });
      }

      const task = await Task.findOne({
        _id: req.params.id,
        userId: req.user.id,
      }).lean();

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }

      res.status(200).json({
        success: true,
        data: { task },
      });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch task',
      });
    }
  }
);

// -----------------------------------------------
// POST /api/tasks — Create task and enqueue
// -----------------------------------------------
router.post(
  '/',
  [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('input')
      .notEmpty().withMessage('Input text is required')
      .isLength({ max: 50000 }).withMessage('Input text cannot exceed 50000 characters'),
    body('operation')
      .notEmpty().withMessage('Operation is required')
      .isIn(OPERATIONS).withMessage(`Operation must be one of: ${OPERATIONS.join(', ')}`),
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

      const { title, input, operation } = req.body;

      const task = await Task.create({
        userId: req.user.id,
        title,
        input,
        operation,
        status: 'pending',
        logs: [
          {
            timestamp: new Date(),
            message: `Task created. Operation: ${operation}`,
            level: 'info',
          },
        ],
      });

      try {
        await addTaskJob(task._id.toString(), input, operation);

        await Task.findByIdAndUpdate(task._id, {
          $push: {
            logs: {
              timestamp: new Date(),
              message: 'Job enqueued to processing queue',
              level: 'info',
            },
          },
        });
      } catch (queueError) {
        console.error('Failed to enqueue task:', queueError);

        await Task.findByIdAndUpdate(task._id, {
          status: 'failed',
          $push: {
            logs: {
              timestamp: new Date(),
              message: `Failed to enqueue: ${queueError.message}`,
              level: 'error',
            },
          },
        });

        return res.status(503).json({
          success: false,
          message: 'Task created but failed to enqueue. Queue service may be down.',
          data: { task: { ...task.toJSON(), status: 'failed' } },
        });
      }

      res.status(201).json({
        success: true,
        message: 'Task created and queued for processing',
        data: { task },
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create task',
      });
    }
  }
);

// -----------------------------------------------
// POST /api/tasks/:id/run — Re-run a failed task
// -----------------------------------------------
router.post(
  '/:id/run',
  [
    param('id').isMongoId().withMessage('Invalid task ID'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid task ID',
        });
      }

      const task = await Task.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }

      if (task.status !== 'failed') {
        return res.status(400).json({
          success: false,
          message: `Cannot re-run task with status '${task.status}'. Only failed tasks can be re-run.`,
        });
      }

      task.status = 'pending';
      task.result = null;
      task.startedAt = null;
      task.completedAt = null;
      task.retryCount += 1;
      task.logs.push({
        timestamp: new Date(),
        message: `Task re-queued (retry #${task.retryCount})`,
        level: 'info',
      });
      await task.save();

      await addTaskJob(
        task._id.toString(),
        task.input,
        task.operation
      );

      await Task.findByIdAndUpdate(task._id, {
        $push: {
          logs: {
            timestamp: new Date(),
            message: 'Job re-enqueued to processing queue',
            level: 'info',
          },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Task re-queued for processing',
        data: { task },
      });
    } catch (error) {
      console.error('Re-run task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to re-run task',
      });
    }
  }
);

export default router;
