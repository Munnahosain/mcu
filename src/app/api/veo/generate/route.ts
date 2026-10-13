import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import { resolveUserApiKey } from '@/server/services/vision-service';
import { consumeCredits, InsufficientCreditsError, refundCredits } from '@/server/services/credit-service';
import { getFeatureFlagDenial } from '@/server/services/feature-flag-service';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  let creditReserved = false;
  let usesOwnApiKey = false;

  try {
    userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required to generate videos.' },
        { status: 401 }
      );
    }

    const featureDenial = await getFeatureFlagDenial(userId, 'ai_tools', 'AI generation');
    if (featureDenial) return NextResponse.json({ error: featureDenial }, { status: 403 });

    const rateLimitError = enforceRateLimit(req, userId, {
      limit: 6,
      windowMs: 60 * 1000,
      keyPrefix: 'veo-generate',
    });
    if (rateLimitError) return rateLimitError;

    const storedGeminiKey = await resolveUserApiKey(userId, 'Google Gemini');
    usesOwnApiKey = Boolean(storedGeminiKey);
    const apiKey = storedGeminiKey?.apiKey || process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Gemini API key is not configured. Add your key in Settings or contact the administrator.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { prompt, image, aspectRatio = '16:9', resolution = '720p' } = body;

    if (!prompt && !image) {
      return NextResponse.json(
        { error: 'Please provide either a prompt or an image to animate.' },
        { status: 400 }
      );
    }

    const validAspectRatios = ['16:9', '9:16'];
    const selectedAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : '16:9';

    await consumeCredits(userId, 5, 'Veo video generation', 'heavy_ai', { usesOwnApiKey });
    creditReserved = true;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let imagePayload: { imageBytes: string; mimeType: string } | undefined = undefined;
    if (image && typeof image === 'string') {
      let base64Data = image;
      let mimeType = 'image/png';
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
      imagePayload = {
        imageBytes: base64Data,
        mimeType,
      };
    }

    const videoConfig = {
      numberOfVideos: 1,
      resolution: resolution === '1080p' ? '1080p' : '720p',
      aspectRatio: selectedAspectRatio as '16:9' | '9:16',
    };

    // Use veo-3.1-fast-generate-preview per requirement
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || (imagePayload ? 'Animate this visual with smooth natural motion' : 'Cinematic motion graphic'),
      ...(imagePayload ? { image: imagePayload } : {}),
      config: videoConfig,
    });

    return NextResponse.json({
      operationName: operation.name,
      model: 'veo-3.1-fast-generate-preview',
      aspectRatio: selectedAspectRatio,
    });
  } catch (err: unknown) {
    if (creditReserved && userId) {
      await refundCredits(userId, 5, 'Failed Veo video generation refund', 'heavy_ai', { usesOwnApiKey })
        .catch((refundError) => console.error('[veo/generate] credit refund error:', refundError));
    }
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    console.error('Veo video generation error:', err);
    const message = err instanceof Error ? err.message : String(err || 'Failed to start video generation.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
