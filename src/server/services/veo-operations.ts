import { connectToDatabase } from '@/server/db/mongodb';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { VeoOperation } from '@/server/models/VeoOperation';
import { refundCredits, type CreditReceipt } from '@/server/services/credit-service';
import { resolveUserApiKey } from '@/server/services/vision-service';

export interface VeoOperationRecord {
  operationName: string;
  userId: string;
  usesOwnApiKey: boolean;
  receipt: CreditReceipt;
  status: 'running' | 'succeeded' | 'failed';
  refunded: boolean;
}

// Dev / no-database fallback.
const memoryOps = new Map<string, VeoOperationRecord>();

export async function recordVeoOperation(record: Omit<VeoOperationRecord, 'status' | 'refunded'>) {
  if (!hasMongoDbConfig()) {
    memoryOps.set(record.operationName, { ...record, status: 'running', refunded: false });
    return;
  }
  await connectToDatabase();
  await VeoOperation.create({ ...record, status: 'running', refunded: false });
}

/** Returns the operation only if it belongs to this user. */
export async function getOwnedVeoOperation(operationName: string, userId: string): Promise<VeoOperationRecord | null> {
  if (!operationName || typeof operationName !== 'string') return null;
  if (!hasMongoDbConfig()) {
    const op = memoryOps.get(operationName);
    return op && op.userId === userId ? op : null;
  }
  await connectToDatabase();
  return await VeoOperation.findOne({ operationName, userId }).lean() as VeoOperationRecord | null;
}

export async function markVeoSucceeded(operationName: string) {
  if (!hasMongoDbConfig()) {
    const op = memoryOps.get(operationName);
    if (op) op.status = 'succeeded';
    return;
  }
  await VeoOperation.updateOne({ operationName, status: 'running' }, { $set: { status: 'succeeded' } });
}

/** Marks a finished operation as failed and refunds its credits exactly once. */
export async function settleVeoFailure(operationName: string) {
  let claimed: VeoOperationRecord | null = null;
  if (!hasMongoDbConfig()) {
    const op = memoryOps.get(operationName);
    if (op && !op.refunded) {
      op.refunded = true;
      op.status = 'failed';
      claimed = op;
    }
  } else {
    await connectToDatabase();
    claimed = await VeoOperation.findOneAndUpdate(
      { operationName, refunded: false },
      { $set: { refunded: true, status: 'failed' } },
      { new: true },
    ).lean() as VeoOperationRecord | null;
  }
  if (!claimed || !claimed.receipt?.effectiveAmount) return;
  await refundCredits(claimed.userId, claimed.receipt, 'Failed Veo video generation refund')
    .catch((error) => console.error('[veo] refund error:', error));
}

/** Same key choice as when the operation was started: the user's own Gemini key, or the server key. */
export async function resolveVeoApiKey(userId: string, usesOwnApiKey: boolean) {
  if (usesOwnApiKey) {
    const stored = await resolveUserApiKey(userId, 'Google Gemini');
    if (stored?.apiKey) return stored.apiKey;
  }
  return process.env.GEMINI_API_KEY?.trim() || '';
}
