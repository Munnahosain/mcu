import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { FeatureFlag } from '@/server/models/FeatureFlag';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';

const SUPPORTED_FLAG_KEYS = new Set([
  'analysis', 'ai_tools', 'metadata_generation', 'prompt_generation', 'general_ai', 'svg_motion',
  'background_removal', 'bg_remover', 'export_high_res', 'advanced_metadata', 'batch_generation',
  'advanced_ai', 'heavy_ai', 'three_d_generation', 'grid_generation', 'palette_generation',
  'typebox_generation', 'bento_generation', 'ascii_generation', 'trading_generation',
  'splitter_export', 'pattern_generation', 'motion_generation', 'color_extraction',
  'image_palette', 'pattern_maker', 'vector_splitter',
]);

function normalizeFlag(input: Record<string, unknown>) {
  const key = typeof input.key === 'string' ? input.key.trim().toLowerCase() : '';
  if (!key) return null;

  const plans = Array.isArray(input.plans)
    ? input.plans.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    key,
    enabled: input.enabled === true,
    plans,
    message: typeof input.message === 'string' ? input.message.trim().slice(0, 500) : '',
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    if (!hasMongoDbConfig()) {
      return NextResponse.json({
        success: true,
        flags: inMemoryStore.featureFlags,
      });
    }

    await connectToDatabase();
    const flags = await FeatureFlag.find().sort({ key: 1 }).lean();
    return NextResponse.json({ success: true, flags: flags.map((flag) => ({ ...flag, _id: String(flag._id) })) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const flag = normalizeFlag(body);
    if (!flag) return NextResponse.json({ success: false, error: 'Feature key is required.' }, { status: 400 });

    if (!hasMongoDbConfig()) {
      const existing = inMemoryStore.featureFlags.find(f => f.key === flag.key);
      if (existing) {
        existing.enabled = flag.enabled;
        existing.plans = flag.plans;
        existing.message = flag.message;
        existing.updatedAt = new Date().toISOString();
        return NextResponse.json({ success: true, flag: existing });
      }
      const newFlag = {
        _id: `flag-${Date.now()}`,
        ...flag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      inMemoryStore.featureFlags.push(newFlag);
      return NextResponse.json({ success: true, flag: newFlag });
    }

    await connectToDatabase();
    const updated = await FeatureFlag.findOneAndUpdate(
      { key: flag.key },
      { $set: { ...flag } },
      { upsert: true, new: true },
    ).lean();

    return NextResponse.json({ success: true, flag: updated ? { ...updated, _id: String(updated._id) } : null });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const key = typeof body.key === 'string' ? body.key.trim().toLowerCase() : '';
    if (!key) {
      return NextResponse.json({ success: false, error: 'Feature key is required.' }, { status: 400 });
    }
    if (SUPPORTED_FLAG_KEYS.has(key)) {
      return NextResponse.json(
        { success: false, error: 'Supported feature keys cannot be deleted. Disable the flag instead.' },
        { status: 400 }
      );
    }

    if (!hasMongoDbConfig()) {
      const index = inMemoryStore.featureFlags.findIndex((flag) => flag.key === key);
      if (index === -1) {
        return NextResponse.json({ success: false, error: 'Feature flag not found.' }, { status: 404 });
      }
      inMemoryStore.featureFlags.splice(index, 1);
      return NextResponse.json({ success: true });
    }

    await connectToDatabase();
    const deleted = await FeatureFlag.findOneAndDelete({ key }).lean();
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Feature flag not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
