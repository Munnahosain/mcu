import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { getFeatureFlagDenial } from '@/server/services/feature-flag-service';

const CHECKABLE_FLAGS = new Set([
  'analysis', 'ai_tools', 'metadata_generation', 'prompt_generation', 'general_ai',
  'svg_motion', 'background_removal', 'bg_remover', 'export_high_res',
  'advanced_metadata', 'batch_generation', 'advanced_ai', 'heavy_ai',
  'three_d_generation', 'grid_generation', 'palette_generation', 'typebox_generation',
  'bento_generation', 'ascii_generation', 'trading_generation', 'splitter_export',
  'pattern_generation', 'motion_generation', 'color_extraction', 'image_palette',
  'pattern_maker', 'vector_splitter',
]);

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  const keys = new URL(req.url).searchParams.get('key')
    ?.split(',')
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean) || [];
  if (keys.length === 0 || keys.some((key) => !CHECKABLE_FLAGS.has(key))) {
    return NextResponse.json({ success: false, error: 'Unsupported feature flag.' }, { status: 400 });
  }

  for (const key of keys) {
    const legacyKey = key === 'background_removal' ? 'bg_remover' : undefined;
    const error = await getFeatureFlagDenial(userId, key, key.replaceAll('_', ' '), legacyKey);
    if (error) {
      return NextResponse.json({ success: false, error, disabledKey: key }, { status: 403 });
    }
  }

  return NextResponse.json({ success: true, enabled: true, keys });
}
