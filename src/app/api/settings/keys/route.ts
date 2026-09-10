import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/server/db/mongodb';
import { ProviderKey } from '@/server/models/ProviderKey';
import { decryptSecret, encryptSecret } from '@/server/auth/secret-encryption';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import crypto from 'node:crypto';

import { enforceRateLimit } from '@/server/auth/rate-limit';

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const rateLimitError = enforceRateLimit(req, userId, { limit: 30, windowMs: 60 * 1000, keyPrefix: 'settings-keys-get' });
  if (rateLimitError) return rateLimitError;

  await connectToDatabase();
  const keys = await ProviderKey.find({ userId }).sort({ createdAt: 1 }).lean();
  return NextResponse.json({
    success: true,
    keys: keys.map((item) => ({
      id: String(item._id),
      provider: item.provider,
      model: item.model,
      lastFour: item.lastFour,
    })),
  });
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json() as { provider?: string; key?: string; model?: string };
    const provider = body.provider?.trim();
    const key = body.key?.trim();
    if (!provider || !key) return NextResponse.json({ success: false, error: 'Provider and API key are required.' }, { status: 400 });
    await connectToDatabase();
    const encryptedKey = encryptSecret(key);
    const fingerprint = crypto.createHash('sha256').update(key).digest('hex');
    const saved = await ProviderKey.findOneAndUpdate(
      { userId, provider, fingerprint },
      { userId, provider, encryptedKey, fingerprint, lastFour: key.slice(-4), model: body.model || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return NextResponse.json({ success: true, key: { id: String(saved._id), provider: saved.provider, lastFour: saved.lastFour, model: saved.model } });
  } catch (error) {
    console.error('Provider key save error:', error);
    return NextResponse.json({ success: false, error: 'Could not save API key. Check MongoDB and ENCRYPTION_KEY configuration.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as { id?: string };
  if (!body.id) return NextResponse.json({ success: false, error: 'Key id is required.' }, { status: 400 });
  await connectToDatabase();
  await ProviderKey.deleteOne({ _id: body.id, userId });
  return NextResponse.json({ success: true });
}