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
  // The provider selected in the UI is authoritative. Prefix detection made
  // valid keys fail when a provider used a non-standard key format.
  if (selectedProvider) return selectedProvider;
  const k = apiKey.trim();
  if (k.startsWith('gsk_')) return 'Groq';
  if (k.startsWith('sk-or-')) return 'OpenRouter';
  if (k.startsWith('sk-proj-') || (k.startsWith('sk-') && !k.startsWith('sk-or-'))) return 'OpenAI';
  if (k.startsWith('AIza')) return 'Google Gemini';
  return 'Groq';
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 50000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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

function buildPrompt(titleLength: number, keywordsCount: number): string {
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
3. "description": approximately 150 characters.
4. "category": single category name only (e.g. "Nature", "Business", "Technology").
5. Return ONLY the raw JSON object — no backticks, no markdown, no explanation.`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const apiKey = (formData.get('apiKey') as string | null)?.trim();
    const providerHint = (formData.get('provider') as string) || 'Groq';
    const modelHint = (formData.get('model') as string) || '';
    const titleLength = Math.min(Math.max(parseInt((formData.get('titleLength') as string) || '200'), 10), 500);
    const keywordsCount = Math.min(Math.max(parseInt((formData.get('keywordsCount') as string) || '30'), 5), 50);

    if (!image || !apiKey) {
      return NextResponse.json({ success: false, error: 'Missing image or API key.' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const { base64, dataUrl } = await prepareImage(buffer);

    const provider = detectProvider(apiKey, providerHint);
    console.log(`[generate] provider=${provider}, model=${modelHint}, title=${titleLength}, kw=${keywordsCount}`);

    const prompt = buildPrompt(titleLength, keywordsCount);
    // Keep enough headroom for long titles and up to 50 keywords without truncating JSON.
    const MAX_OUT = 4096;

    let responseText: string | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (provider === 'Groq') {
          // Groq vision: MUST use content array with image_url type — NOT inline base64 in text
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
              messages: [
                {
                  role: 'user',
                  // Correct Groq vision format: content is an ARRAY with image_url object first, then text
                  content: [
                    {
                      type: 'image_url',
                      image_url: {
                        url: dataUrl,  // data:image/jpeg;base64,... format
                      }
                    },
                    {
                      type: 'text',
                      text: prompt
                    }
                  ]
                }
              ],
              response_format: { type: 'json_object' },
              max_tokens: MAX_OUT,
              temperature: 0.1,
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
          const res = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inline_data: { mime_type: 'image/jpeg', data: base64 } },
                    { text: prompt }
                  ]
                }],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: MAX_OUT,
                  // camelCase is correct for Gemini API
                  responseMimeType: 'application/json'
                }
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
          if (!responseText) {
            throw new Error(data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'Gemini returned an empty response. Check that this model is enabled for your API key.');
          }

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
                  { type: 'text', text: prompt }
                ]
              }],
              response_format: { type: 'json_object' },
              max_tokens: MAX_OUT,
              temperature: 0.1,
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
                  { type: 'text', text: prompt }
                ]
              }],
              response_format: { type: 'json_object' },
              max_tokens: MAX_OUT,
              temperature: 0.1,
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
          // Mistral vision via pixtral models
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
                  { type: 'text', text: prompt }
                ]
              }],
              response_format: { type: 'json_object' },
              max_tokens: MAX_OUT,
              temperature: 0.1,
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
        console.warn(`[generate] attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY_MS * (attempt + 1)}ms`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    if (!responseText) throw lastError || new Error('Generation failed — no response from AI');

    // Parse JSON — be tolerant of markdown fences
    let metadata: Record<string, unknown>;
    try {
      // Strip markdown code fences if present
      const clean = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      metadata = JSON.parse(clean);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`AI returned non-JSON output: ${responseText.slice(0, 180)}`);
      metadata = JSON.parse(match[0]);
    }

    // ── Normalize keywords ─────────────────────────────────────────────────
    // Some models (Gemini, older Groq) return keywords as a comma-separated STRING
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
            .map(k => String(k).trim().toLowerCase().replace(/^["']|["']$/g, ''))
            .filter(Boolean)
        )
      ];
      metadata.keywords = unique.slice(0, keywordsCount);
      console.log(`[generate] keywords: ${(metadata.keywords as string[]).length}/${keywordsCount}`);
    } else {
      metadata.keywords = [];
    }

    // ── Enforce title length ───────────────────────────────────────────────
    if (typeof metadata.title === 'string' && (metadata.title as string).length > titleLength) {
      metadata.title = (metadata.title as string).slice(0, titleLength).trimEnd();
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
