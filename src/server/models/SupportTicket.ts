import { Schema, model, models } from 'mongoose';

export const SUPPORT_STATUSES = ['open', 'in_progress', 'waiting_for_user', 'waiting_for_support', 'resolved', 'closed'] as const;
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const SupportTicketSchema = new Schema({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 150 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'SupportCategory', required: true, index: true },
  priority: { type: String, enum: SUPPORT_PRIORITIES, default: 'normal', index: true },
  status: { type: String, enum: SUPPORT_STATUSES, default: 'open', index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  relatedPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
  relatedSubscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
  relatedCreditTransactionId: { type: Schema.Types.ObjectId, ref: 'CreditLedger', default: null },
  relatedTool: { type: String, default: '', maxlength: 100 },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessageBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  unreadForUser: { type: Boolean, default: false, index: true },
  unreadForAdmin: { type: Boolean, default: true, index: true },
  firstResponseAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });
SupportTicketSchema.index({ categoryId: 1, status: 1 });
SupportTicketSchema.index({ priority: 1, status: 1 });

export const SupportTicket = models.SupportTicket || model('SupportTicket', SupportTicketSchema);
