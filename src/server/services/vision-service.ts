import sharp from 'sharp';
import { connectToDatabase } from '@/server/db/mongodb';
import { ProviderKey } from '@/server/models/ProviderKey';
import { decryptSecret } from '@/server/auth/secret-encryption';

export const AI_MAX_RETRIES = 2;
export const AI_RETRY_DELAY_MS = 1000;
export const MAX_IMAGE_SIZE = 768;
export const JPEG_QUALITY = 75;
export const MAX_PROVIDER_IMAGE_BYTES = 900_000;

export interface ProviderError {
  status?: number;
  response?: { status?: number };
  cause?: { status?: number };
  message?: string;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as ProviderError;
  return e.status || e.response?.status || e.cause?.status;
}

export function isRetryableProviderError(error: unknown): boolean {
  const status = getStatusCode(error);
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return (
    status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    message.includes('capacity') || message.includes('overloaded') ||
    message.includes('unavailable') || message.includes('timeout') ||
    message.includes('rate limit')
  );
}

export function getFriendlyProviderMessage(error: unknown): string {
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
  if (status === 413 || message.includes('too large') || message.includes('payload')) {
    return 'The image request was too large for this AI provider. Try a smaller image or another provider.';
  }
  if (status === 503 || message.includes('capacity') || message.includes('overloaded')) {
    return 'AI provider is temporarily busy. Please retry or switch provider.';
  }
  if (status === 504 || message.includes('timeout')) {
    return 'AI provider timed out. Please retry.';
  }
  return errMsg || 'Generation failed';
}

export function detectProvider(apiKey: string, selectedProvider?: string): string {
  if (selectedProvider && selectedProvider.trim()) return selectedProvider.trim();
  const k = apiKey.trim();
  if (k.startsWith('gsk_')) return 'Groq';
  if (k.startsWith('sk-or-')) return 'OpenRouter';
  if (k.startsWith('sk-proj-') || (k.startsWith('sk-') && !k.startsWith('sk-or-'))) return 'OpenAI';
  if (k.startsWith('AIza')) return 'Google Gemini';
  return 'Groq';
}

export async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 55000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function prepareImage(imageBuffer: Buffer, maxSize = MAX_IMAGE_SIZE, quality = JPEG_QUALITY): Promise<{ base64: string; dataUrl: string }> {
  let curSize = maxSize;
  let curQuality = quality;

  let resized = await sharp(imageBuffer)
    .resize(curSize, curSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: curQuality })
    .toBuffer();

  while (resized.length > MAX_PROVIDER_IMAGE_BYTES && curSize > 256) {
    curSize = Math.max(Math.floor(curSize * 0.75), 256);
    curQuality = Math.max(curQuality - 10, 40);
    resized = await sharp(imageBuffer)
      .resize(curSize, curSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: curQuality })
      .toBuffer();
  }

  const base64 = resized.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  return { base64, dataUrl };
}

export async function resolveUserApiKey(
  userId: string | null,
  providerPreference?: string
): Promise<{ apiKey: string; provider: string; model?: string } | null> {
  if (!userId) return null;
  try {
    await connectToDatabase();
    const query: { userId: string; provider?: string } = { userId };
    if (providerPreference) {
      query.provider = providerPreference;
    }
    const keys = await ProviderKey.find(query).sort({ createdAt: -1 }).lean();
    if (!keys || keys.length === 0) return null;

    // Pick first available key for requested provider, or first active key
    for (const item of keys) {
      try {
        const decrypted = decryptSecret(item.encryptedKey);
        if (decrypted && decrypted.trim()) {
          return {
            apiKey: decrypted.trim(),
            provider: item.provider,
            model: item.model || undefined,
          };
        }
      } catch (e) {
        console.warn(`[resolveUserApiKey] Failed to decrypt key ${item._id}:`, e);
      }
    }
    return null;
  } catch (err) {
    console.error('[resolveUserApiKey] Database error:', err);
    return null;
  }
}

export interface CallVisionOptions {
  provider: string;
  model?: string;
  apiKey: string;
  prompt: string;
  base64: string;
  dataUrl: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export async function callVisionProvider(options: CallVisionOptions): Promise<string> {
  const {
    provider,
    model: modelHint = '',
    apiKey,
    prompt,
    base64,
    dataUrl,
    jsonMode = false,
    maxTokens = 2048,
    temperature = 0.1,
    timeoutMs = 55000,
  } = options;

  let responseText: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
    try {
      if (provider === 'Groq') {
        const groqModel = (() => {
          if (modelHint && (modelHint.includes('scout') || modelHint.includes('maverick') || modelHint.includes('vision') || modelHint.includes('llava'))) {
            return modelHint;
          }
          return 'meta-llama/llama-4-scout-17b-16e-instruct';
        })();

        const body: Record<string, unknown> = {
          model: groqModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          max_tokens: maxTokens,
          temperature,
        };
        if (jsonMode) {
          body.response_format = { type: 'json_object' };
        }

        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        }, timeoutMs);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const e = new Error(err.error?.message || `Groq error ${res.status}`);
          (e as unknown as { status: number }).status = res.status;
          throw e;
        }

        const data = await res.json();
        responseText = data.choices?.[0]?.message?.content;

      } else if (provider === 'Google Gemini') {
        const geminiModel = modelHint.includes('gemini') ? modelHint : 'gemini-2.5-flash-lite';
        const generationConfig: Record<string, unknown> = {
          temperature,
          maxOutputTokens: maxTokens,
        };
        if (jsonMode) {
          generationConfig.responseMimeType = 'application/json';
        }

        const geminiBody = JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: 'image/jpeg', data: base64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig,
        });

        let res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: geminiBody,
          },
          timeoutMs
        );

        if (!res.ok && (res.status === 400 || res.status === 404 || res.status === 503) && geminiModel !== 'gemini-2.5-flash-lite') {
          console.warn(`[callVisionProvider] Gemini model ${geminiModel} unavailable; falling back to gemini-2.5-flash-lite`);
          res = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: geminiBody,
            },
            timeoutMs
          );
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const e = new Error(err.error?.message || `Gemini error ${res.status}`);
          (e as unknown as { status: number }).status = res.status;
          throw e;
        }

        const data = await res.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
          throw new Error(data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'Gemini returned an empty response.');
        }

      } else if (provider === 'OpenRouter') {
        const orModel = modelHint || 'google/gemini-2.0-flash-exp:free';
        const body: Record<string, unknown> = {
          model: orModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          max_tokens: maxTokens,
          temperature,
        };
        if (jsonMode) {
          body.response_format = { type: 'json_object' };
        }

        const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://mcustock.ai',
            'X-Title': 'MCUSTOCK AI',
          },
          body: JSON.stringify(body),
        }, timeoutMs);

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
        const body: Record<string, unknown> = {
          model: oaiModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          max_tokens: maxTokens,
          temperature,
        };
        if (jsonMode) {
          body.response_format = { type: 'json_object' };
        }

        const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        }, timeoutMs);

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
        const body: Record<string, unknown> = {
          model: mistralModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          max_tokens: maxTokens,
          temperature,
        };
        if (jsonMode) {
          body.response_format = { type: 'json_object' };
        }

        const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        }, timeoutMs);

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
      if (!isRetryableProviderError(err) || attempt === AI_MAX_RETRIES - 1) break;
      console.warn(`[callVisionProvider] attempt ${attempt + 1} failed, retrying in ${AI_RETRY_DELAY_MS * (attempt + 1)}ms`);
      await sleep(AI_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  if (!responseText) throw lastError || new Error('Generation failed — no response from AI');
  return responseText;
}
