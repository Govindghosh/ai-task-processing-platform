import mongoose from 'mongoose';

export const OPERATIONS = ['uppercase', 'lowercase', 'reverse', 'wordcount'];
export const STATUSES = ['pending', 'running', 'success', 'failed'];

const logEntrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
    },
    message: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
    },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    input: {
      type: String,
      required: [true, 'Input text is required'],
      maxlength: [50000, 'Input text cannot exceed 50000 characters'],
    },
    operation: {
      type: String,
      required: [true, 'Operation is required'],
      enum: {
        values: OPERATIONS,
        message: 'Operation must be one of: ' + OPERATIONS.join(', '),
      },
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'pending',
      index: true,
    },
    result: {
      type: String,
      default: null,
    },
    logs: {
      type: [logEntrySchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for common query patterns
taskSchema.index({ userId: 1, createdAt: -1 }); // User's tasks sorted by newest
taskSchema.index({ status: 1, createdAt: 1 });   // Queue monitoring
taskSchema.index({ userId: 1, status: 1 });       // User's tasks by status

const Task = mongoose.model('Task', taskSchema);
export default Task;
