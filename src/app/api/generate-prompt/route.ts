import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import {
  AllKeysExhaustedError,
  generateWithFailover,
  NoApiKeyError,
  prepareImage,
} from '@/server/services/vision-service';
import { consumeCredits, InsufficientCreditsError, refundCredits, type CreditReceipt } from '@/server/services/credit-service';
import { getFirstFeatureFlagDenial } from '@/server/services/feature-flag-service';
import { incrementUsage } from '@/server/services/usage-service';
import { getVectorFormat, prepareVectorPreview, VectorPreviewError } from '@/server/services/vector-preview';
import { providerErrorResponse, validateImageUpload, withImageDecode } from '@/server/services/route-helpers';

export const maxDuration = 60;

export async function POST(req: Request) {
  let creditReceipt: CreditReceipt | null = null;
  const deadlineAt = Date.now() + 52_000;
  let creditReserved = false;
  let authenticatedUserId: string | null = null;
  try {
    const userId = await getAuthenticatedUserId(req);
    authenticatedUserId = userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required to generate prompts.' }, { status: 401 });
    }
    const denial = await getFirstFeatureFlagDenial(userId, [
      { key: 'ai_tools', label: 'AI generation' },
      { key: 'prompt_generation', label: 'Prompt generation' },
    ]);
    if (denial) return NextResponse.json({ success: false, error: denial.error }, { status: 403 });

    const rateLimitError = await enforceRateLimit(req, userId, {
      limit: 120,
      windowMs: 60 * 1000,
      keyPrefix: 'generate-prompt',
    });
    if (rateLimitError) return rateLimitError;

    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const clientKey = (formData.get('apiKey') as string | null)?.trim() || '';
    const providerHint = (formData.get('provider') as string) || 'Groq';
    const modelHint = (formData.get('model') as string) || '';
    const promptLength = Math.min(Math.max(parseInt((formData.get('promptLength') as string) || '600', 10), 100), 1500);

    const usePrefix = formData.get('usePrefix') === 'true';
    const prefixText = ((formData.get('prefixText') as string) || '').trim();
    const useSuffix = formData.get('useSuffix') === 'true';
    const suffixText = ((formData.get('suffixText') as string) || '').trim();
    const useNegativePrompt = formData.get('useNegativePrompt') === 'true';
    const negativePromptText = ((formData.get('negativePromptText') as string) || '').trim();
    const instructionsStr = ((formData.get('instructions') as string) || '').trim().toLowerCase();

    const uploadError = validateImageUpload(image);
    if (uploadError) return uploadError;
    if (!image) return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });

    const buffer = Buffer.from(await image.arrayBuffer());
    const vectorFormat = getVectorFormat(image.name);
    const imageBuffer = vectorFormat
      ? (await prepareVectorPreview(buffer, image.name)).buffer
      : buffer;
    const { base64, dataUrl } = await withImageDecode(() => prepareImage(imageBuffer, 768, 75));
    creditReceipt = (await consumeCredits(userId, 1, 'AI prompt generation', 'prompt_generation', { usesOwnApiKey: true })).receipt;
    creditReserved = true;

    console.log(`[generate-prompt] provider=${providerHint}, model=${modelHint}, length=${promptLength}`);

    // Build instruction modifiers cleanly
    const extras: string[] = [];
    if (usePrefix && prefixText) extras.push(`START the prompt with exactly these words: "${prefixText}"`);
    if (useSuffix && suffixText) extras.push(`END the prompt with exactly these words: "${suffixText}"`);
    if (useNegativePrompt && negativePromptText) extras.push(`DO NOT include or mention any of these: ${negativePromptText}`);
    if (instructionsStr.includes('white background')) extras.push('Describe the subject on a pristine white background.');
    if (instructionsStr.includes('camera parameters')) {
      extras.push('Include camera details: lens type, focal length, aperture, shutter speed, ISO.');
    } else {
      extras.push('Do NOT include camera specs, EXIF data, or technical photography settings.');
    }

    const extrasBlock = extras.length > 0 ? extras.map((e, i) => `${i + 1}. ${e}`).join('\n') : '';

    const systemPrompt = `You are a professional AI image prompt engineer specializing in Midjourney and Stable Diffusion prompts.

Analyze the image thoroughly and write a vivid, detailed text-to-image generation prompt.

TARGET LENGTH: Your prompt MUST be approximately ${promptLength} characters (±30 characters). This is mandatory.

${extrasBlock ? `ADDITIONAL INSTRUCTIONS:\n${extrasBlock}\n` : ''}
OUTPUT RULES:
- Return ONLY the plain prompt text — no quotes, no labels, no intro sentence
- Describe: artistic style, main subject, composition, lighting, colors, atmosphere, textures, mood
- Be specific and evocative — write like a professional art director
- Ensure total character count is close to ${promptLength}`;

    const result = await generateWithFailover({
      userId,
      preferredProvider: providerHint,
      preferredModel: modelHint,
      clientKey: clientKey || undefined,
      deadlineAt,
      prompt: systemPrompt,
      base64,
      dataUrl,
      jsonMode: false,
      maxTokens: 1500,
      temperature: 0.7,
    });

    void Promise.all([
      incrementUsage(userId, 'apiRequests').catch((usageError) => console.error('[generate-prompt] usage api error:', usageError)),
      incrementUsage(userId, 'creditsUsed').catch((usageError) => console.error('[generate-prompt] usage credits error:', usageError)),
    ]);

    return NextResponse.json({
      success: true,
      prompt: result.text.trim(),
      provider: result.provider,
      usedFallbackProvider: result.usedFallbackProvider,
      previewDataUrl: vectorFormat ? dataUrl : undefined });
  } catch (error) {
    if (creditReserved && authenticatedUserId) {
      await refundCredits(authenticatedUserId, creditReceipt ?? 1, 'Failed AI prompt generation refund', 'prompt_generation', { usesOwnApiKey: true }).catch((refundError) => console.error('[generate-prompt] credit refund error:', refundError));
    }
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 402 });
    }
    if (error instanceof AllKeysExhaustedError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code, retryAt: error.retryAt }, { status: 429 });
    }
    if (error instanceof NoApiKeyError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 });
    }
    if (error instanceof VectorPreviewError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 422 });
    }
    console.error('[generate-prompt] error:', error instanceof Error ? error.message : error);
    return providerErrorResponse(error);
  }
}
