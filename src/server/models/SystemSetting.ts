import { Schema, model, models } from 'mongoose';

const SystemSettingSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const SystemSetting = models.SystemSetting || model('SystemSetting', SystemSettingSchema);