import { Schema, model, models } from 'mongoose';

const AnnouncementSchema = new Schema({
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 5000 },
  type: { type: String, enum: ['info', 'success', 'warning', 'critical'], default: 'info' },
  targetAudience: { type: String, enum: ['everyone', 'free', 'pro', 'premium', 'selected'], default: 'everyone' },
  selectedUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export const Announcement = models.Announcement || model('Announcement', AnnouncementSchema);