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

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);

    const rateLimitError = enforceRateLimit(req, userId, {
      limit: 20,
      windowMs: 60 * 1000,
      keyPrefix: 'generate-prompt',
    });
    if (rateLimitError) return rateLimitError;

    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    let apiKey = (formData.get('apiKey') as string | null)?.trim() || '';
    let providerHint = (formData.get('provider') as string) || 'Groq';
    let modelHint = (formData.get('model') as string) || '';
    const promptLength = Math.min(Math.max(parseInt((formData.get('promptLength') as string) || '600', 10), 100), 1500);

    const usePrefix = formData.get('usePrefix') === 'true';
    const prefixText = ((formData.get('prefixText') as string) || '').trim();
    const useSuffix = formData.get('useSuffix') === 'true';
    const suffixText = ((formData.get('suffixText') as string) || '').trim();
    const useNegativePrompt = formData.get('useNegativePrompt') === 'true';
    const negativePromptText = ((formData.get('negativePromptText') as string) || '').trim();
    const instructionsStr = ((formData.get('instructions') as string) || '').trim().toLowerCase();

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
    const { base64, dataUrl } = await prepareImage(buffer, 768, 75);
    const provider = detectProvider(apiKey, providerHint);

    console.log(`[generate-prompt] provider=${provider}, model=${modelHint}, length=${promptLength}`);

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

    const responseText = await callVisionProvider({
      provider,
      model: modelHint,
      apiKey,
      prompt: systemPrompt,
      base64,
      dataUrl,
      jsonMode: false,
      maxTokens: 1500,
      temperature: 0.7,
    });

    return NextResponse.json({ success: true, prompt: responseText.trim() });
  } catch (error) {
    const status = getStatusCode(error) || 500;
    console.error('[generate-prompt] error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: getFriendlyProviderMessage(error) },
      { status }
    );
  }
}
