import { Schema, deleteModel, model, models } from 'mongoose';

export const USER_ROLES = ['super_admin', 'admin', 'support', 'user'] as const;
export const USER_STATUSES = ['active', 'suspended', 'banned', 'pending'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

const UserSchema = new Schema({
  legacyId: {
    type: String,
    index: true,
    sparse: true,
  },
  name: {
    type: String,
    required: [true, 'Please provide a name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
  },
  role: {
    type: String,
    enum: USER_ROLES,
    default: 'user',
    index: true,
  },
  status: {
    type: String,
    enum: USER_STATUSES,
    default: 'active',
    index: true,
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
    default: null,
    index: true,
  },
  permissions: {
    type: [String],
    default: [],
  },
  credits: {
    monthly: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    used: { type: Number, default: 0, min: 0 },
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.index({ createdAt: -1 });

// Refresh the cached development model after adding authorization fields.
if (models.User && !models.User.schema.path('role')) {
  deleteModel('User');
}

export const User = models.User || model('User', UserSchema);
