import { Schema, model, models } from 'mongoose';

/** Ties a Veo long-running operation to the user who started it, for ownership checks and refunds. */
const VeoOperationSchema = new Schema(
  {
    operationName: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    usesOwnApiKey: { type: Boolean, default: false },
    receipt: {
      monthlyDeducted: { type: Number, default: 0 },
      bonusDeducted: { type: Number, default: 0 },
      effectiveAmount: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['running', 'succeeded', 'failed'], default: 'running' },
    refunded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const VeoOperation = models.VeoOperation || model('VeoOperation', VeoOperationSchema);
