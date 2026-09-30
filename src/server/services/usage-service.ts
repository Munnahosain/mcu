import { connectToDatabase } from '@/server/db/mongodb';
import { Usage } from '@/server/models/Usage';
import { hasMongoDbConfig } from '@/server/db/database-config';

export const USAGE_FIELDS = ['metadataGenerated', 'backgroundRemoved', 'threeDGenerated', 'imagesUploaded', 'apiRequests', 'storageUsedMB', 'creditsUsed'] as const;
export type UsageField = (typeof USAGE_FIELDS)[number];

export function currentUsagePeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getUserUsage(userId: string, period = currentUsagePeriod()) {
  if (!hasMongoDbConfig()) return null;
  await connectToDatabase();
  return Usage.findOne({ userId, period }).lean();
}

export async function incrementUsage(userId: string, field: UsageField, amount = 1, period = currentUsagePeriod()) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Usage amount must be positive.');
  if (!hasMongoDbConfig()) return null;
  await connectToDatabase();
  return Usage.findOneAndUpdate(
    { userId, period },
    { $inc: { [field]: amount }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}