import { Schema, model, models } from 'mongoose';

const SupportMessageSchema = new Schema({
  ticketId: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderRole: { type: String, enum: ['user', 'admin', 'support_agent', 'system'], required: true },
  message: { type: String, required: true, maxlength: 5000 },
  attachments: [{ name: String, url: String, mimeType: String, size: Number, storageKey: String }],
  internalNote: { type: Boolean, default: false, index: true },
}, { timestamps: true });

SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });
SupportMessageSchema.index({ senderId: 1, createdAt: -1 });

export const SupportMessage = models.SupportMessage || model('SupportMessage', SupportMessageSchema);
