import crypto from 'node:crypto';
import sharp from 'sharp';
import { connectToDatabase } from '@/server/db/mongodb';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { ProviderKey } from '@/server/models/ProviderKey';
import { decryptSecret } from '@/server/auth/secret-encryption';
import { AI_DEFAULT_MODELS } from '@/lib/ai-models';
import { inMemoryStore } from '@/server/db/in-memory-store';

export const AI_MAX_RETRIES = 2;
export const AI_RETRY_DELAY_MS = 1000;
export const AI_PROVIDER_TIMEOUT_MS = 20_000;
export const MAX_IMAGE_SIZE = 768;
export const JPEG_QUALITY = 75;
export const MAX_PROVIDER_IMAGE_BYTES = 900_000;

/** Order used when the selected provider has no usable key left. */
export const PROVIDER_FALLBACK_CHAIN = ['Google Gemini', 'Groq', 'OpenRouter', 'OpenAI', 'Mistral AI'];

export interface ProviderError {
  status?: number;
  response?: { status?: number };
  cause?: { status?: number };
  message?: string;
  retryAfterMs?: number;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as ProviderError;
  return e.status || e.response?.status || e.cause?.status;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as ProviderError).retryAfterMs;
}

export function isRetryableProviderError(error: unknown): boolean {
  const status = getStatusCode(error);
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return (
    status === 500 || status === 502 || status === 503 || status === 504 ||
    message.includes('capacity') || message.includes('overloaded') ||
    message.includes('unavailable') || message.includes('timeout') || message.includes('aborted') ||
    message.includes('empty response')
  );
}

export function getFriendlyProviderMessage(error: unknown): string {
  const errMsg = error instanceof Error ? error.message : String(error || '');
  const message = errMsg.toLowerCase();
  const status = getStatusCode(error);

  if (error instanceof AllKeysExhaustedError || error instanceof NoApiKeyError) {
    return errMsg;
  }
  if (message.includes('aborted') || message.includes('timeout') || message.includes('fetch failed')) {
    return 'AI provider request timed out or could not be reached. Please retry or switch provider.';
  }
  if (status === 401 || message.includes('invalid api key') || message.includes('api key not valid') || message.includes('unauthorized')) {
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
  if (status === 504) {
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
  const timeout = setTimeout(() => controller.abort(), Math.max(timeoutMs, 1000));
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
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: curQuality })
    .toBuffer();

  while (resized.length > MAX_PROVIDER_IMAGE_BYTES && curSize > 256) {
    curSize = Math.max(Math.floor(curSize * 0.75), 256);
    curQuality = Math.max(curQuality - 10, 40);
    resized = await sharp(imageBuffer)
      .resize(curSize, curSize, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: curQuality })
      .toBuffer();
  }

  const base64 = resized.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  return { base64, dataUrl };
}

/* ------------------------------------------------------------------ */
/* Provider error helpers                                              */
/* ------------------------------------------------------------------ */

function parseDurationMs(value: string): number | undefined {
  // Formats: "13s", "13.5s", "2m30.5s", "1h2m3s", "150ms"
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?ms$/.test(trimmed)) return Math.ceil(parseFloat(trimmed));
  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?$/);
  if (!match || (!match[1] && !match[2] && !match[3])) return undefined;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return Math.ceil(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function extractRetryAfterMs(res: Response, body: unknown, message: string): number | undefined {
  // Google: error.details[].retryDelay = "13s"
  const details = (body as { error?: { details?: Array<Record<string, unknown>> } })?.error?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (typeof detail?.retryDelay === 'string') {
        const ms = parseDurationMs(detail.retryDelay);
        if (ms) return ms;
      }
    }
  }
  // Standard header
  const header = res.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(date - Date.now(), 1000);
  }
  // Groq/OpenAI style: "Please try again in 7.66s" / "in 2m30.5s"
  const inMessage = message.match(/try again in\s+([0-9hms.]+)/i);
  if (inMessage) {
    const ms = parseDurationMs(inMessage[1].replace(/\.$/, ''));
    if (ms) return ms;
  }
  return undefined;
}

async function buildProviderError(label: string, res: Response): Promise<Error> {
  const body = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } | string; message?: string };
  const rawMessage = typeof body.error === 'string'
    ? body.error
    : body.error?.message || body.message || `${label} error ${res.status}`;
  const e = new Error(rawMessage) as Error & ProviderError;
  let status = res.status;
  // Gemini answers an invalid key with HTTP 400 — normalise it to 401 so it is treated as a key problem.
  if (/api key not valid|api_key_invalid|invalid api key|incorrect api key/i.test(rawMessage)) status = 401;
  e.status = status;
  e.retryAfterMs = extractRetryAfterMs(res, body, rawMessage);
  return e;
}

type ProviderErrorKind = 'quota' | 'auth' | 'forbidden' | 'model' | 'transient' | 'fatal';

function classifyProviderError(error: unknown): ProviderErrorKind {
  const status = getStatusCode(error);
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();

  if (status === 413) return 'fatal';
  if (
    status === 429 || status === 402 ||
    message.includes('quota') || message.includes('rate limit') || message.includes('rate_limit') ||
    message.includes('resource_exhausted') || message.includes('resource has been exhausted') ||
    message.includes('too many requests') || message.includes('insufficient credits')
  ) return 'quota';
  if (
    status === 401 || message.includes('api key not valid') || message.includes('invalid api key') ||
    message.includes('incorrect api key') || message.includes('api_key_invalid')
  ) return 'auth';
  if (status === 403) return 'forbidden';
  if (isRetryableProviderError(error) || message.includes('fetch failed')) return 'transient';
  if (status === 400 || status === 404 || status === 422 || message.includes('not found') || message.includes('not supported') || message.includes('does not exist')) {
    return 'model';
  }
  return 'transient';
}

function isDailyLimit(message: string) {
  const m = message.toLowerCase();
  return m.includes('per day') || m.includes('perday') || m.includes('daily') || m.includes('(rpd)') || m.includes('(tpd)');
}

/* ------------------------------------------------------------------ */
/* Gemini thinking control                                             */
/* ------------------------------------------------------------------ */

function geminiThinkingConfig(model: string): { config: Record<string, unknown>; extraTokens: number } | null {
  const m = model.toLowerCase();
  if (m.includes('2.5-pro')) return { config: { thinkingBudget: 128 }, extraTokens: 512 };
  if (m.includes('2.5-flash')) return { config: { thinkingBudget: 0 }, extraTokens: 0 };
  if (m.includes('gemini-3') || m.includes('latest')) return { config: { thinkingLevel: 'low' }, extraTokens: 2048 };
  return null;
}

/* ------------------------------------------------------------------ */
/* Key storage helpers                                                 */
/* ------------------------------------------------------------------ */

type StoredKeyDoc = {
  _id: unknown;
  provider: string;
  encryptedKey: string;
  fingerprint?: string;
  model?: string;
  disabled?: boolean;
  cooldownUntil?: Date | string | null;
};

function fingerprintKey(apiKey: string) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Cooldowns are also kept in memory so keys that are not stored in the DB (or a DB write that fails) still rotate.
const memoryKeyState = new Map<string, { cooldownUntil: number; disabled?: boolean }>();
const rotationCursor = new Map<string, number>();

function getMemoryState(fingerprint: string) {
  const state = memoryKeyState.get(fingerprint);
  if (state && !state.disabled && state.cooldownUntil <= Date.now()) {
    memoryKeyState.delete(fingerprint);
    return undefined;
  }
  return state;
}

function isUsable(doc: StoredKeyDoc | null, fingerprint: string, now = Date.now()) {
  const mem = getMemoryState(fingerprint);
  if (mem?.disabled || (mem && mem.cooldownUntil > now)) return false;
  if (doc?.disabled) return false;
  const until = doc?.cooldownUntil ? new Date(doc.cooldownUntil).getTime() : 0;
  return !(until > now);
}

function nextAvailableAt(doc: StoredKeyDoc | null, fingerprint: string): number | null {
  const mem = getMemoryState(fingerprint);
  if (mem?.disabled || doc?.disabled) return null;
  const until = Math.max(mem?.cooldownUntil || 0, doc?.cooldownUntil ? new Date(doc.cooldownUntil).getTime() : 0);
  return until > Date.now() ? until : null;
}

async function loadStoredKeys(userId: string): Promise<StoredKeyDoc[]> {
  if (!hasMongoDbConfig()) {
    // Dev / no-database mode: keys saved through /api/settings/keys live in the in-memory store.
    return inMemoryStore.providerKeys
      .filter((k) => k.userId === userId && k.encryptedKey)
      .map((k) => ({ _id: k.id, provider: k.provider, encryptedKey: k.encryptedKey as string, fingerprint: k.fingerprint, model: k.model }));
  }
  try {
    await connectToDatabase();
    return await ProviderKey.find({ userId }).sort({ createdAt: 1 }).lean() as unknown as StoredKeyDoc[];
  } catch (err) {
    console.error('[vision-service] Could not load provider keys:', err);
    return [];
  }
}

export async function resolveUserApiKey(
  userId: string | null,
  providerPreference?: string
): Promise<{ apiKey: string; provider: string; model?: string } | null> {
  if (!userId) return null;
  try {
    const docs = (await loadStoredKeys(userId))
      .filter((doc) => !providerPreference || doc.provider === providerPreference)
      .reverse();
    if (docs.length === 0) return null;

    // Prefer keys that are not disabled or cooling down, but still fall back to any decryptable key.
    const decrypted = docs.flatMap((item) => {
      try {
        const apiKey = decryptSecret(item.encryptedKey)?.trim();
        if (!apiKey) return [];
        const fingerprint = item.fingerprint || fingerprintKey(apiKey);
        return [{ apiKey, provider: item.provider, model: item.model || undefined, usable: isUsable(item, fingerprint) }];
      } catch (e) {
        console.warn(`[resolveUserApiKey] Failed to decrypt key ${String(item._id)}:`, e);
        return [];
      }
    });
    const chosen = decrypted.find((k) => k.usable) || decrypted[0];
    return chosen ? { apiKey: chosen.apiKey, provider: chosen.provider, model: chosen.model } : null;
  } catch (err) {
    console.error('[resolveUserApiKey] Database error:', err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Single provider call                                                */
/* ------------------------------------------------------------------ */

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
  /** Total attempts for transient errors (default AI_MAX_RETRIES). Rate-limit errors are never retried here. */
  retries?: number;
}

async function callOpenAiCompatible(
  label: string,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<string | null> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }, timeoutMs);
  if (!res.ok) throw await buildProviderError(label, res);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content.map((part: { text?: string }) => part?.text || '').join('');
    if (joined.trim()) return joined;
  }
  throw new Error(`${label} returned an empty response.`);
}

async function callGemini(options: Required<Pick<CallVisionOptions, 'apiKey' | 'prompt' | 'base64' | 'temperature' | 'maxTokens'>> & {
  model: string;
  jsonMode: boolean;
  timeoutMs: number;
}): Promise<string> {
  const { apiKey, prompt, base64, temperature, maxTokens, jsonMode, timeoutMs } = options;
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(deadline - Date.now(), 1000);

  const send = (model: string, withThinking: boolean) => {
    const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens: maxTokens };
    if (jsonMode) generationConfig.responseMimeType = 'application/json';
    const thinking = geminiThinkingConfig(model);
    if (thinking && withThinking) {
      generationConfig.thinkingConfig = thinking.config;
      generationConfig.maxOutputTokens = maxTokens + thinking.extraTokens;
    } else if (thinking) {
      // Model rejected our thinking settings: leave thinking on but give it room so the answer is not cut off.
      generationConfig.maxOutputTokens = maxTokens + 2048;
    }
    return fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: base64 } }, { text: prompt }] }],
          generationConfig,
        }),
      },
      remaining()
    );
  };

  let model = options.model.includes('gemini') ? options.model : 'gemini-2.5-flash-lite';
  let res = await send(model, true);

  if (!res.ok && res.status === 400) {
    const peek = await res.clone().json().catch(() => ({})) as { error?: { message?: string } };
    if (/thinking/i.test(peek.error?.message || '')) {
      res = await send(model, false);
    }
  }

  if (!res.ok && model !== 'gemini-2.5-flash-lite') {
    const peek = await res.clone().json().catch(() => ({})) as { error?: { message?: string } };
    const msg = peek.error?.message || '';
    if (res.status === 404 || /not found|not supported|is not available/i.test(msg)) {
      console.warn(`[callVisionProvider] Gemini model ${model} unavailable; falling back to gemini-2.5-flash-lite`);
      model = 'gemini-2.5-flash-lite';
      res = await send(model, true);
    }
  }

  if (!res.ok) throw await buildProviderError('Gemini', res);

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts: Array<{ text?: string; thought?: boolean }> = candidate?.content?.parts || [];
  const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  if (!text.trim()) {
    const reason = data.promptFeedback?.blockReason || candidate?.finishReason || 'unknown';
    const e = new Error(`Gemini returned an empty response (${reason}).`) as Error & ProviderError;
    if (data.promptFeedback?.blockReason || reason === 'SAFETY') e.status = 422;
    throw e;
  }
  return text;
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
    timeoutMs = AI_PROVIDER_TIMEOUT_MS,
    retries = AI_MAX_RETRIES,
  } = options;

  const imageMessage = (detail?: 'low') => ([
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: detail ? { url: dataUrl, detail } : { url: dataUrl } },
        { type: 'text', text: prompt },
      ],
    },
  ]);

  let lastError: unknown = null;
  const attempts = Math.max(1, retries);

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      let responseText: string | null = null;

      if (provider === 'Groq') {
        const groqModel = modelHint && /scout|maverick|vision|llava/.test(modelHint)
          ? modelHint
          : 'meta-llama/llama-4-scout-17b-16e-instruct';
        const body: Record<string, unknown> = { model: groqModel, messages: imageMessage(), max_tokens: maxTokens, temperature };
        if (jsonMode) body.response_format = { type: 'json_object' };
        responseText = await callOpenAiCompatible('Groq', 'https://api.groq.com/openai/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, body, timeoutMs);

      } else if (provider === 'Google Gemini') {
        responseText = await callGemini({ apiKey, prompt, base64, temperature, maxTokens, jsonMode, timeoutMs, model: modelHint });

      } else if (provider === 'OpenRouter') {
        const orModel = modelHint || AI_DEFAULT_MODELS.OpenRouter || 'google/gemini-2.5-flash';
        const body: Record<string, unknown> = { model: orModel, messages: imageMessage(), max_tokens: maxTokens, temperature };
        if (jsonMode) body.response_format = { type: 'json_object' };
        responseText = await callOpenAiCompatible('OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://mcustock.ai',
          'X-Title': 'MCUSTOCK AI',
        }, body, timeoutMs);

      } else if (provider === 'OpenAI') {
        const oaiModel = modelHint || 'gpt-4.1-mini';
        const body: Record<string, unknown> = { model: oaiModel, messages: imageMessage('low'), max_tokens: maxTokens, temperature };
        if (jsonMode) body.response_format = { type: 'json_object' };
        responseText = await callOpenAiCompatible('OpenAI', 'https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, body, timeoutMs);

      } else if (provider === 'Mistral AI') {
        const mistralModel = modelHint || 'pixtral-large-latest';
        const body: Record<string, unknown> = { model: mistralModel, messages: imageMessage(), max_tokens: maxTokens, temperature };
        if (jsonMode) body.response_format = { type: 'json_object' };
        responseText = await callOpenAiCompatible('Mistral', 'https://api.mistral.ai/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, body, timeoutMs);

      } else {
        const e = new Error(`Provider "${provider}" is not supported.`) as Error & ProviderError;
        e.status = 400;
        throw e;
      }

      if (responseText) return responseText;
      throw new Error('Generation failed — empty response from AI');
    } catch (err) {
      lastError = err;
      if (!isRetryableProviderError(err) || attempt === attempts - 1) break;
      console.warn(`[callVisionProvider] attempt ${attempt + 1} failed, retrying in ${AI_RETRY_DELAY_MS}ms`);
      await sleep(AI_RETRY_DELAY_MS);
    }
  }

  throw lastError || new Error('Generation failed — no response from AI');
}

/* ------------------------------------------------------------------ */
/* Key pool + automatic failover                                       */
/* ------------------------------------------------------------------ */

export class AllKeysExhaustedError extends Error {
  status = 429;
  code = 'ALL_KEYS_EXHAUSTED';
  retryAt: number | null;
  keyCount: number;
  constructor(retryAt: number | null, keyCount = 0) {
    const when = retryAt
      ? ` The earliest key becomes available again at ${new Date(retryAt).toISOString()}.`
      : ' Add another API key or check the keys in Settings.';
    const count = keyCount === 1 ? '1 key is' : `${keyCount || 'All'} keys are`;
    super(`All ${count} rate-limited / invalid.${when}`.replace('All All', 'All'));
    this.retryAt = retryAt;
    this.keyCount = keyCount;
  }
}

export class NoApiKeyError extends Error {
  status = 400;
  code = 'NO_API_KEY';
  constructor(provider: string) {
    super(`No API key found for ${provider}. Please add your API key in Settings.`);
  }
}

interface PoolKey {
  id?: string;
  apiKey: string;
  provider: string;
  model: string;
  fingerprint: string;
  doc: StoredKeyDoc | null;
}

function providerRank(provider: string, preferred: string) {
  if (provider === preferred) return -1;
  const index = PROVIDER_FALLBACK_CHAIN.indexOf(provider);
  return index === -1 ? PROVIDER_FALLBACK_CHAIN.length : index;
}

async function buildKeyPool(userId: string, preferredProvider: string, clientKey?: string) {
  const docs = await loadStoredKeys(userId);
  const all: PoolKey[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    try {
      const apiKey = decryptSecret(doc.encryptedKey)?.trim();
      if (!apiKey) continue;
      const fingerprint = doc.fingerprint || fingerprintKey(apiKey);
      const dedupe = `${doc.provider}:${fingerprint}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      all.push({ id: String(doc._id), apiKey, provider: doc.provider, model: doc.model || '', fingerprint, doc });
    } catch (e) {
      console.warn(`[key-pool] Failed to decrypt key ${String(doc._id)}:`, e);
    }
  }

  // Rotate the selected provider's keys so load is spread even when the browser sends no key.
  const preferredKeys = all.filter((k) => k.provider === preferredProvider);
  const cursorKey = `${userId}:${preferredProvider}`;
  const cursor = rotationCursor.get(cursorKey) || 0;
  rotationCursor.set(cursorKey, cursor + 1);
  const rotated = preferredKeys.length
    ? [...preferredKeys.slice(cursor % preferredKeys.length), ...preferredKeys.slice(0, cursor % preferredKeys.length)]
    : [];
  const others = all
    .filter((k) => k.provider !== preferredProvider)
    .sort((a, b) => providerRank(a.provider, preferredProvider) - providerRank(b.provider, preferredProvider));
  let ordered = [...rotated, ...others];

  // A key sent by the browser goes first (the browser already round-robins its own keys).
  if (clientKey) {
    const fingerprint = fingerprintKey(clientKey);
    const existing = ordered.find((k) => k.fingerprint === fingerprint && k.provider === preferredProvider);
    const clientEntry: PoolKey = existing || {
      apiKey: clientKey,
      provider: detectProvider(clientKey, preferredProvider),
      model: '',
      fingerprint,
      doc: null,
    };
    ordered = [clientEntry, ...ordered.filter((k) => k !== existing)];
  }

  const usable = ordered.filter((k) => isUsable(k.doc, k.fingerprint));
  const retryTimes = ordered.map((k) => nextAvailableAt(k.doc, k.fingerprint)).filter((t): t is number => t !== null);
  return {
    total: ordered.length,
    usable,
    earliestRetryAt: retryTimes.length ? Math.min(...retryTimes) : null,
  };
}

async function markKey(key: PoolKey, state: { cooldownMs?: number; disabled?: boolean; reason: string }) {
  const cooldownUntil = state.cooldownMs ? Date.now() + state.cooldownMs : 0;
  memoryKeyState.set(key.fingerprint, { cooldownUntil, disabled: state.disabled });
  if (!key.id || !hasMongoDbConfig()) return cooldownUntil || null;
  try {
    await ProviderKey.updateOne(
      { _id: key.id },
      {
        $set: {
          ...(state.disabled ? { disabled: true } : {}),
          ...(cooldownUntil ? { cooldownUntil: new Date(cooldownUntil) } : {}),
          lastError: state.reason.slice(0, 300),
        },
      }
    );
  } catch (err) {
    console.warn('[key-pool] Could not persist key state:', err);
  }
  return cooldownUntil || null;
}

export interface KeyPoolOptions {
  userId: string;
  preferredProvider: string;
  preferredModel?: string;
  clientKey?: string;
  /** Absolute timestamp (ms) by which we must have an answer. */
  deadlineAt: number;
}

export interface KeyPoolResult {
  text: string;
  provider: string;
  model: string;
  keyId?: string;
  /** True when the requested provider had no usable key and another provider answered. */
  usedFallbackProvider: boolean;
}

type InvokeWithKey = (key: { provider: string; apiKey: string; model: string }, timeoutMs: number) => Promise<string>;

function isTimeoutError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return message.includes('aborted') || message.includes('timeout') || message.includes('timed out');
}

/**
 * Tries every usable key — the selected provider first, then the other providers the user has keys for —
 * until one answers. Rate-limited keys are put on cooldown and invalid keys are disabled; the next key
 * is tried immediately (no sleep). Throws AllKeysExhaustedError only after every key has failed.
 */
export async function runWithKeyPool(options: KeyPoolOptions, invoke: InvokeWithKey): Promise<KeyPoolResult> {
  const { userId, preferredProvider, preferredModel = '', clientKey, deadlineAt } = options;
  const pool = await buildKeyPool(userId, preferredProvider, clientKey);

  if (pool.total === 0) throw new NoApiKeyError(preferredProvider);
  if (pool.usable.length === 0) throw new AllKeysExhaustedError(pool.earliestRetryAt, pool.total);

  const skippedProviders = new Set<string>();
  const transientKeys: PoolKey[] = [];
  const cooldowns: number[] = pool.earliestRetryAt ? [pool.earliestRetryAt] : [];
  let lastError: unknown = null;
  let onlyKeyProblems = true;
  let ranOutOfTime = false;

  const attempt = async (key: PoolKey, isSecondPass: boolean): Promise<KeyPoolResult | null> => {
    const remaining = deadlineAt - Date.now();
    if (remaining < 5000) {
      ranOutOfTime = true;
      return null;
    }
    const model = key.provider === preferredProvider ? (preferredModel || key.model) : key.model;
    try {
      const text = await invoke({ provider: key.provider, apiKey: key.apiKey, model }, Math.min(AI_PROVIDER_TIMEOUT_MS, remaining - 1500));
      if (key.provider !== preferredProvider || key !== pool.usable[0]) {
        console.log(`[key-pool] switched to ${key.provider} key …${key.apiKey.slice(-4)}`);
      }
      return { text, provider: key.provider, model, keyId: key.id, usedFallbackProvider: key.provider !== preferredProvider };
    } catch (err) {
      lastError = err;
      const kind = classifyProviderError(err);
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[key-pool] ${key.provider} key …${key.apiKey.slice(-4)} failed (${kind}): ${message.slice(0, 160)}`);

      if (kind === 'quota') {
        const retryAfter = getRetryAfterMs(err);
        const base = isDailyLimit(message) ? 60 * 60 * 1000 : 60 * 1000;
        const cooldownMs = Math.min(Math.max(retryAfter ?? base, 10_000), 24 * 60 * 60 * 1000);
        const until = await markKey(key, { cooldownMs, reason: message });
        if (until) cooldowns.push(until);
      } else if (kind === 'auth') {
        await markKey(key, { disabled: true, reason: message });
      } else if (kind === 'forbidden') {
        const until = await markKey(key, { cooldownMs: 30 * 60 * 1000, reason: message });
        if (until) cooldowns.push(until);
      } else if (kind === 'model') {
        onlyKeyProblems = false;
        skippedProviders.add(key.provider);
      } else if (kind === 'transient') {
        onlyKeyProblems = false;
        // A timed-out key is not retried in this request — the next key/provider gets the time instead.
        if (!isSecondPass && !isTimeoutError(err)) transientKeys.push(key);
      } else {
        throw err;
      }
      return null;
    }
  };

  const usable = pool.usable;
  for (let i = 0; i < usable.length; i++) {
    const key = usable[i];
    if (skippedProviders.has(key.provider)) continue;
    const result = await attempt(key, false);
    if (result) return result;
    if (deadlineAt - Date.now() < 5000) {
      if (usable.slice(i + 1).some((k) => !skippedProviders.has(k.provider))) ranOutOfTime = true;
      break;
    }
  }

  if (ranOutOfTime && onlyKeyProblems) {
    const e = new Error('AI providers are responding slowly. Please retry — remaining keys will be tried next.') as Error & ProviderError;
    e.status = 503;
    throw e;
  }

  // One more pass over keys that had a temporary server error (5xx), if there is still time.
  for (const key of transientKeys) {
    if (deadlineAt - Date.now() < 8000) break;
    await sleep(500);
    const result = await attempt(key, true);
    if (result) return result;
  }

  if (onlyKeyProblems) {
    const future = cooldowns.filter((t) => t > Date.now());
    throw new AllKeysExhaustedError(future.length ? Math.min(...future) : null, pool.total);
  }
  throw lastError || new Error('Generation failed — no response from AI');
}

export interface FailoverOptions extends KeyPoolOptions, Omit<CallVisionOptions, 'provider' | 'apiKey' | 'model' | 'timeoutMs' | 'retries'> {}

/** Vision request (image + prompt) through the key pool. */
export async function generateWithFailover(options: FailoverOptions): Promise<KeyPoolResult> {
  const { userId, preferredProvider, preferredModel, clientKey, deadlineAt, ...callOptions } = options;
  return runWithKeyPool({ userId, preferredProvider, preferredModel, clientKey, deadlineAt }, (key, timeoutMs) =>
    callVisionProvider({ ...callOptions, provider: key.provider, model: key.model, apiKey: key.apiKey, retries: 1, timeoutMs })
  );
}

/** True for errors caused by the AI provider rejecting the user's key (not our own session). */
export function isProviderKeyError(error: unknown): boolean {
  const kind = classifyProviderError(error);
  return kind === 'auth' || kind === 'forbidden';
}
