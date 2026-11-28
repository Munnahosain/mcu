import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import {
  AllKeysExhaustedError,
  generateWithFailover,
  NoApiKeyError,
  prepareImage,
} from '@/server/services/vision-service';
import { incrementUsage } from '@/server/services/usage-service';
import { consumeCredits, InsufficientCreditsError, refundCredits, type CreditReceipt } from '@/server/services/credit-service';
import { getFirstFeatureFlagDenial } from '@/server/services/feature-flag-service';
import { getVectorFormat, prepareVectorPreview, VectorPreviewError } from '@/server/services/vector-preview';
import { providerErrorResponse, validateImageUpload, withImageDecode } from '@/server/services/route-helpers';

export const maxDuration = 60;

function buildPrompt(
  titleLength: number,
  descriptionLength: number,
  keywordsCount: number,
  platform: string,
  additionalKeywords: string,
  negativeTitleWords: string,
  negativeKeywords: string,
  isVideo: boolean
): string {
  return `You are an expert stock ${isVideo ? 'video footage' : 'photography'} SEO metadata generator.

Analyze the ${isVideo ? 'four temporally ordered frames from this video' : 'image'} and return ONLY a valid JSON object. No extra text, no markdown fences, no code blocks.

Return exactly this JSON structure:
{
  "title": "descriptive SEO title for the visual content",
  "description": "detailed description of the subject, action, mood, and context",
  "keywords": ["keyword1", "keyword2", "keyword3", "..."],
  "category": "best matching stock content category"
}

${isVideo ? 'Describe the visible action and motion across the frames. Do not invent audio, dialogue, or events not shown.' : ''}

STRICT RULES — FOLLOW EXACTLY:
1. "title": MUST be between ${Math.max(titleLength - 20, 10)} and ${titleLength} characters. Do NOT exceed ${titleLength} characters.
2. "keywords": MUST be a JSON array containing EXACTLY ${keywordsCount} unique lowercase strings. Use short, single-word keywords where possible so the complete JSON fits in the response.
3. "description": approximately ${descriptionLength} characters and optimized for ${platform}.
4. "category": single category name only (e.g. "Nature", "Business", "Technology").
${additionalKeywords ? `5. Include these relevant terms where appropriate: ${additionalKeywords}.` : ''}
${negativeTitleWords ? `6. Do not use these words in the title: ${negativeTitleWords}.` : ''}
${negativeKeywords ? `7. Do not use these keywords: ${negativeKeywords}.` : ''}
8. Return ONLY the raw JSON object — no backticks, no markdown, no explanation.`;
}

/** Parses model output, recovering what it can when the JSON was cut off. */
function parseMetadataResponse(responseText: string): Record<string, unknown> {
  const clean = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // fall through
  }
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // fall through
    }
  }

  const readString = (field: string) => {
    const m = clean.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"?`));
    if (!m) return undefined;
    try {
      return JSON.parse(`"${m[1].replace(/\\$/, '')}"`) as string;
    } catch {
      return m[1];
    }
  };
  const title = readString('title');
  if (!title) throw new Error(`AI returned non-JSON output: ${responseText.slice(0, 180)}`);

  let keywords: string[] = [];
  const kwBlock = clean.match(/"keywords"\s*:\s*\[([\s\S]*)/);
  if (kwBlock) {
    keywords = [...kwBlock[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  }
  return {
    title,
    description: readString('description') || '',
    keywords,
    category: readString('category') || 'General',
  };
}

export async function POST(req: Request) {
  let creditReceipt: CreditReceipt | null = null;
  const deadlineAt = Date.now() + 52_000;
  let creditReserved = false;
  let authenticatedUserId: string | null = null;
  try {
    const userId = await getAuthenticatedUserId(req);
    authenticatedUserId = userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required to generate metadata.' }, { status: 401 });
    }
    const denial = await getFirstFeatureFlagDenial(userId, [
      { key: 'ai_tools', label: 'AI generation' },
      { key: 'metadata_generation', label: 'Metadata generation' },
    ]);
    if (denial) return NextResponse.json({ success: false, error: denial.error }, { status: 403 });

    const rateLimitError = await enforceRateLimit(req, userId, {
      limit: 120,
      windowMs: 60 * 1000,
      keyPrefix: 'generate',
    });
    if (rateLimitError) return rateLimitError;

    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const clientKey = (formData.get('apiKey') as string | null)?.trim() || '';
    const providerHint = (formData.get('provider') as string) || 'Groq';
    const modelHint = (formData.get('model') as string) || '';

    const titleLength = Math.min(Math.max(parseInt((formData.get('titleLength') as string) || '200', 10), 10), 500);
    const descriptionLength = Math.min(Math.max(parseInt((formData.get('descriptionLength') as string) || '150', 10), 50), 500);
    const keywordsCount = Math.min(Math.max(parseInt((formData.get('keywordsCount') as string) || '30', 10), 5), 50);
    const platform = (formData.get('platform') as string) || 'General';
    const additionalKeywords = ((formData.get('additionalKeywords') as string) || '').trim();
    const negativeTitleWords = ((formData.get('negativeTitleWords') as string) || '').trim();
    const negativeKeywords = ((formData.get('negativeKeywords') as string) || '').trim();
    const isVideo = formData.get('contentType') === 'video';

    const uploadError = validateImageUpload(image);
    if (uploadError) return uploadError;
    if (!image) return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });

    const buffer = Buffer.from(await image.arrayBuffer());
    const vectorFormat = getVectorFormat(image.name);
    const imageBuffer = vectorFormat
      ? (await prepareVectorPreview(buffer, image.name)).buffer
      : buffer;
    const { base64, dataUrl } = await withImageDecode(() => prepareImage(imageBuffer, 512, 65));
    creditReceipt = (await consumeCredits(userId, 1, 'AI metadata generation', 'metadata_generation', { usesOwnApiKey: true })).receipt;
    creditReserved = true;

    console.log(`[generate] provider=${providerHint}, model=${modelHint}, title=${titleLength}, description=${descriptionLength}, kw=${keywordsCount}, platform=${platform}`);

    const prompt = buildPrompt(
      titleLength,
      descriptionLength,
      keywordsCount,
      platform,
      additionalKeywords,
      negativeTitleWords,
      negativeKeywords,
      isVideo
    );

    // Room for the whole JSON: title + description + keywords (+ overhead). Too small a budget cuts answers off.
    const maxTokens = Math.min(2048, 300 + keywordsCount * 12 + descriptionLength + titleLength);
    const request = {
      userId,
      preferredProvider: providerHint,
      preferredModel: modelHint,
      clientKey: clientKey || undefined,
      deadlineAt,
      base64,
      dataUrl,
      jsonMode: true,
      temperature: 0.1,
    };

    let result = await generateWithFailover({ ...request, prompt, maxTokens });
    let metadata: Record<string, unknown>;
    try {
      metadata = parseMetadataResponse(result.text);
    } catch (parseError) {
      // Unusable answer: ask once more for a shorter JSON if there is still time.
      if (deadlineAt - Date.now() < 12_000) throw parseError;
      result = await generateWithFailover({
        ...request,
        prompt: `${prompt}\n\nIMPORTANT: Your previous answer was not valid JSON. Return a SHORTER, complete JSON object only.`,
        maxTokens: 2048,
      });
      metadata = parseMetadataResponse(result.text);
    }

    // Normalize keywords
    if (typeof metadata.keywords === 'string') {
      metadata.keywords = (metadata.keywords as string)
        .split(/[,;|\n]+/)
        .map((k: string) => k.trim().toLowerCase())
        .filter(Boolean);
    }

    if (Array.isArray(metadata.keywords)) {
      const unique = [
        ...new Set(
          (metadata.keywords as string[])
            .map((k) => String(k).trim().toLowerCase().replace(/^["']|["']$/g, ''))
            .filter(Boolean)
        ),
      ];
      metadata.keywords = unique.slice(0, keywordsCount);
    } else {
      metadata.keywords = [];
    }

    metadata.title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
    metadata.description = typeof metadata.description === 'string' ? metadata.description.trim() : '';
    metadata.category = typeof metadata.category === 'string' && metadata.category.trim()
      ? metadata.category.trim()
      : 'General';

    if (typeof metadata.title === 'string' && metadata.title.length > titleLength) {
      metadata.title = metadata.title.slice(0, titleLength).trimEnd();
    }

    void Promise.all([
      incrementUsage(userId, 'metadataGenerated').catch((usageError) => console.error('[generate] usage metadata error:', usageError)),
      incrementUsage(userId, 'apiRequests').catch((usageError) => console.error('[generate] usage api error:', usageError)),
      incrementUsage(userId, 'creditsUsed').catch((usageError) => console.error('[generate] usage credits error:', usageError)),
    ]);

    return NextResponse.json({
      success: true,
      metadata,
      provider: result.provider,
      usedFallbackProvider: result.usedFallbackProvider,
      previewDataUrl: vectorFormat ? dataUrl : undefined,
    });
  } catch (error) {
    if (creditReserved && authenticatedUserId) {
      await refundCredits(authenticatedUserId, creditReceipt ?? 1, 'Failed AI metadata generation refund', 'metadata_generation', { usesOwnApiKey: true }).catch((refundError) => console.error('[generate] credit refund error:', refundError));
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
    console.error('[generate] error:', error instanceof Error ? error.message : error);
    return providerErrorResponse(error);
  }
}
