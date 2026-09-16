import { Schema, model, models } from 'mongoose';

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = models.AuditLog || model('AuditLog', AuditLogSchema);