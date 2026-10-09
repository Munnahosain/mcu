import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { getFirstFeatureFlagDenial } from '@/server/services/feature-flag-service';

const CHECKABLE_FLAGS = new Set([
  'analysis', 'ai_tools', 'metadata_generation', 'prompt_generation', 'general_ai',
  'svg_motion', 'background_removal', 'bg_remover', 'export_high_res',
  'advanced_metadata', 'batch_generation', 'advanced_ai', 'heavy_ai',
  'three_d_generation', 'grid_generation', 'palette_generation', 'typebox_generation',
  'bento_generation', 'ascii_generation', 'trading_generation', 'splitter_export',
  'motion_generation', 'color_extraction', 'vector_splitter',
]);

function featureFlagResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return featureFlagResponse({ success: false, error: 'Authentication required.' }, 401);
  }

  const keys = new URL(req.url).searchParams.get('key')
    ?.split(',')
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean) || [];
  if (keys.length === 0 || keys.some((key) => !CHECKABLE_FLAGS.has(key))) {
    return featureFlagResponse({ success: false, error: 'Unsupported feature flag.' }, 400);
  }

  const denial = await getFirstFeatureFlagDenial(userId, keys.map((key) => ({
    key,
    label: key.replaceAll('_', ' '),
    fallbackKey: key === 'background_removal' ? 'bg_remover' : undefined,
  })));
  if (denial) {
    return featureFlagResponse({ success: false, error: denial.error, disabledKey: denial.key }, 403);
  }

  return featureFlagResponse({ success: true, enabled: true, keys });
}
