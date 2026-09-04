import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const maxDuration = 60;

const MAX_IMAGE_SIZE = 768;
const JPEG_QUALITY = 75;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ProviderError {
  status?: number;
  response?: { status?: number };
  cause?: { status?: number };
  message?: string;
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as ProviderError;
  return e.status || e.response?.status || e.cause?.status;
}

function isRetryableProviderError(error: unknown): boolean {
  const status = getStatusCode(error);
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return (
    status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    message.includes('capacity') || message.includes('overloaded') ||
    message.includes('unavailable') || message.includes('timeout') ||
    message.includes('rate limit')
  );
}

function getFriendlyProviderMessage(error: unknown): string {
  const errMsg = error instanceof Error ? error.message : String(error || '');
  const message = errMsg.toLowerCase();
  const status = getStatusCode(error);

  if (message.includes('aborted') || message.includes('timeout') || message.includes('fetch failed')) {
    return 'AI provider request timed out or could not be reached. Check your API key, model access, and network connection.';
  }
  if (status === 401 || message.includes('invalid api key') || message.includes('unauthorized')) {
    return 'Invalid API key. Please check your key is correct, active, and saved under the right provider.';
  }
  if (status === 429 || message.includes('rate limit') || message.includes('quota')) {
    return 'Rate limit reached. Please retry in a moment or add another API key.';
  }
  if (status === 503 || message.includes('capacity') || message.includes('overloaded')) {
    return 'AI provider is temporarily busy. Please retry or switch provider.';
  }
  if (status === 504 || message.includes('timeout')) {
    return 'AI provider timed out. Please retry.';
  }
  return errMsg || 'Generation failed';
}

function detectProvider(apiKey: string, selectedProvider: string): string {
  if (selectedProvider) return selectedProvider;
  const k = apiKey.trim();
  if (k.startsWith('gsk_')) return 'Groq';
  if (k.startsWith('sk-or-')) return 'OpenRouter';
  if (k.startsWith('sk-proj-') || (k.startsWith('sk-') && !k.startsWith('sk-or-'))) return 'OpenAI';
  if (k.startsWith('AIza')) return 'Google Gemini';
  return 'Groq';
}

async function prepareImage(imageBuffer: Buffer): Promise<{ base64: string; dataUrl: string }> {
  const resized = await sharp(imageBuffer)
    .resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const base64 = resized.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  return { base64, dataUrl };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const apiKey = (formData.get('apiKey') as string | null)?.trim();
    const providerHint = (formData.get('provider') as string) || 'Groq';
    const modelHint = (formData.get('model') as string) || '';
    const promptLength = Math.min(Math.max(parseInt((formData.get('promptLength') as string) || '600'), 100), 1500);

    const usePrefix = formData.get('usePrefix') === 'true';
    const prefixText = ((formData.get('prefixText') as string) || '').trim();
    const useSuffix = formData.get('useSuffix') === 'true';
    const suffixText = ((formData.get('suffixText') as string) || '').trim();
    const useNegativePrompt = formData.get('useNegativePrompt') === 'true';
    const negativePromptText = ((formData.get('negativePromptText') as string) || '').trim();
    const instructionsStr = ((formData.get('instructions') as string) || '').trim().toLowerCase();

    if (!image || !apiKey) {
      return NextResponse.json({ success: false, error: 'Missing image or API key.' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const { base64, dataUrl } = await prepareImage(buffer);
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

    let responseText: string | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (provider === 'Groq') {
          const groqModel = (() => {
            if (modelHint && (modelHint.includes('scout') || modelHint.includes('maverick') || modelHint.includes('vision') || modelHint.includes('llava'))) return modelHint;
            return 'meta-llama/llama-4-scout-17b-16e-instruct';
          })();

          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [{
                role: 'user',
                // Correct Groq vision format: content array with image_url object
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: dataUrl }
                  },
                  {
                    type: 'text',
                    text: systemPrompt
                  }
                ]
              }],
              max_tokens: 1500,
              temperature: 0.7,
            })
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const e = new Error(err.error?.message || `Groq error ${res.status}`);
            (e as unknown as { status: number }).status = res.status;
            throw e;
          }
          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content;

        } else if (provider === 'Google Gemini') {
          const geminiModel = modelHint.includes('gemini') ? modelHint : 'gemini-2.0-flash';
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inline_data: { mime_type: 'image/jpeg', data: base64 } },
                    { text: systemPrompt }
                  ]
                }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
              })
            }
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const e = new Error(err.error?.message || `Gemini error ${res.status}`);
            (e as unknown as { status: number }).status = res.status;
            throw e;
          }
          const data = await res.json();
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        } else if (provider === 'OpenRouter') {
          const orModel = modelHint || 'google/gemini-2.0-flash-exp:free';
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://mcustock.ai',
              'X-Title': 'MCUSTOCK AI'
            },
            body: JSON.stringify({
              model: orModel,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: dataUrl } },
                  { type: 'text', text: systemPrompt }
                ]
              }],
              max_tokens: 1500,
              temperature: 0.7,
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const e = new Error(err.error?.message || `OpenRouter error ${res.status}`);
            (e as unknown as { status: number }).status = res.status;
            throw e;
          }
          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content;

        } else if (provider === 'OpenAI') {
          const oaiModel = modelHint || 'gpt-4o';
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: oaiModel,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
                  { type: 'text', text: systemPrompt }
                ]
              }],
              max_tokens: 1500,
              temperature: 0.7,
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const e = new Error(err.error?.message || `OpenAI error ${res.status}`);
            (e as unknown as { status: number }).status = res.status;
            throw e;
          }
          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content;

        } else if (provider === 'Mistral AI') {
          const mistralModel = modelHint || 'pixtral-large-latest';
          const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: mistralModel,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: dataUrl } },
                  { type: 'text', text: systemPrompt }
                ]
              }],
              max_tokens: 1500,
              temperature: 0.7,
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const e = new Error(err.error?.message || `Mistral error ${res.status}`);
            (e as unknown as { status: number }).status = res.status;
            throw e;
          }
          const data = await res.json();
          responseText = data.choices?.[0]?.message?.content;

        } else {
          throw new Error(`Provider "${provider}" is not supported.`);
        }

        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (!isRetryableProviderError(err) || attempt === MAX_RETRIES - 1) break;
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    if (!responseText) throw lastError || new Error('Generation failed — no response from AI');

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
