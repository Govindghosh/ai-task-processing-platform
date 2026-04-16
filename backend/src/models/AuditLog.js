import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null, 
    index: true 
  },
  method: { 
    type: String, 
    required: true 
  },
  path: { 
    type: String, 
    required: true 
  },
  statusCode: { 
    type: Number, 
    required: true 
  },
  responseTime: { 
    type: Number, 
    required: true 
  },
  ip: { 
    type: String 
  },
  userAgent: { 
    type: String 
  }
}, { 
  timestamps: { createdAt: true, updatedAt: false } 
});

// Index for fast querying, and a TTL index to auto-delete logs older than 30 days
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model('AuditLog', auditLogSchema);
