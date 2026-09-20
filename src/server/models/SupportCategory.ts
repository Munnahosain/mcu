import { Schema, model, models } from 'mongoose';

const SupportCategorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '', maxlength: 500 },
  icon: { type: String, default: 'LifeBuoy' },
  color: { type: String, default: 'primary' },
  order: { type: Number, default: 0, index: true },
  enabled: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export const SupportCategory = models.SupportCategory || model('SupportCategory', SupportCategorySchema);
