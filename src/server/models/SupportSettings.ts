import { Schema, model, models } from 'mongoose';

const SupportSettingsSchema = new Schema({
  key: { type: String, unique: true, default: 'default' },
  supportEnabled: { type: Boolean, default: true },
  allowNewTickets: { type: Boolean, default: true },
  autoResponse: { type: Boolean, default: true },
  emailNotifications: { type: Boolean, default: false },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const SupportSettings = models.SupportSettings || model('SupportSettings', SupportSettingsSchema);
