import { Schema, model, models } from 'mongoose';

const SupportArticleSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  excerpt: { type: String, default: '', maxlength: 500 },
  content: { type: String, required: true, maxlength: 20000 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'SupportCategory', required: true, index: true },
  tags: { type: [String], default: [] },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0, min: 0 },
  helpfulCount: { type: Number, default: 0, min: 0 },
  notHelpfulCount: { type: Number, default: 0, min: 0 },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

SupportArticleSchema.index({ status: 1, createdAt: -1 });
SupportArticleSchema.index({ categoryId: 1 });
SupportArticleSchema.index({ title: 'text', excerpt: 'text', content: 'text', tags: 'text' });

export const SupportArticle = models.SupportArticle || model('SupportArticle', SupportArticleSchema);
