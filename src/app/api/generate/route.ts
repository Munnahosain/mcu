import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import {
  callVisionProvider,
  detectProvider,
  getFriendlyProviderMessage,
  getStatusCode,
  prepareImage,
  resolveUserApiKey,
} from '@/server/services/vision-service';

export const maxDuration = 60;

function buildPrompt(
  titleLength: number,
  descriptionLength: number,
  keywordsCount: number,
  platform: string,
  additionalKeywords: string,
  negativeTitleWords: string,
  negativeKeywords: string
): string {
  return `You are an expert stock photography SEO metadata generator.

Analyze the image and return ONLY a valid JSON object. No extra text, no markdown fences, no code blocks.

Return exactly this JSON structure:
{
  "title": "descriptive SEO title for the image",
  "description": "detailed description of the image subject, mood, and context",
  "keywords": ["keyword1", "keyword2", "keyword3", "..."],
  "category": "best matching stock photo category"
}

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

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);

    const rateLimitError = enforceRateLimit(req, userId, {
      limit: 20,
      windowMs: 60 * 1000,
      keyPrefix: 'generate',
    });
    if (rateLimitError) return rateLimitError;

    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    let apiKey = (formData.get('apiKey') as string | null)?.trim() || '';
    let providerHint = (formData.get('provider') as string) || 'Groq';
    let modelHint = (formData.get('model') as string) || '';

    const titleLength = Math.min(Math.max(parseInt((formData.get('titleLength') as string) || '200', 10), 10), 500);
    const descriptionLength = Math.min(Math.max(parseInt((formData.get('descriptionLength') as string) || '150', 10), 50), 500);
    const keywordsCount = Math.min(Math.max(parseInt((formData.get('keywordsCount') as string) || '30', 10), 5), 50);
    const platform = (formData.get('platform') as string) || 'General';
    const additionalKeywords = ((formData.get('additionalKeywords') as string) || '').trim();
    const negativeTitleWords = ((formData.get('negativeTitleWords') as string) || '').trim();
    const negativeKeywords = ((formData.get('negativeKeywords') as string) || '').trim();

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });
    }

    // Resolve API key server-side from stored credentials if not provided directly
    if (!apiKey && userId) {
      const serverKey = await resolveUserApiKey(userId, providerHint);
      if (serverKey) {
        apiKey = serverKey.apiKey;
        providerHint = serverKey.provider;
        if (!modelHint && serverKey.model) {
          modelHint = serverKey.model;
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `No API key found for ${providerHint}. Please add your API key in Settings.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const { base64, dataUrl } = await prepareImage(buffer, 512, 65);
    const provider = detectProvider(apiKey, providerHint);

    console.log(`[generate] provider=${provider}, model=${modelHint}, title=${titleLength}, description=${descriptionLength}, kw=${keywordsCount}, platform=${platform}`);

    const prompt = buildPrompt(
      titleLength,
      descriptionLength,
      keywordsCount,
      platform,
      additionalKeywords,
      negativeTitleWords,
      negativeKeywords
    );

    const responseText = await callVisionProvider({
      provider,
      model: modelHint,
      apiKey,
      prompt,
      base64,
      dataUrl,
      jsonMode: true,
      maxTokens: 2048,
      temperature: 0.1,
    });

    // Parse JSON response safely
    let metadata: Record<string, unknown>;
    try {
      const clean = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      metadata = JSON.parse(clean);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`AI returned non-JSON output: ${responseText.slice(0, 180)}`);
      metadata = JSON.parse(match[0]);
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

    return NextResponse.json({ success: true, metadata });
  } catch (error) {
    const status = getStatusCode(error) || 500;
    console.error('[generate] error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: getFriendlyProviderMessage(error) },
      { status }
    );
  }
}
