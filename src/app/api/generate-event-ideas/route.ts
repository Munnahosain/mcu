import { NextResponse } from 'next/server';
import { AI_DEFAULT_MODELS } from '@/lib/ai-models';
import { getAuthenticatedUserId } from '@/server/auth/request-auth';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import { consumeCredits, InsufficientCreditsError, refundCredits, type CreditReceipt } from '@/server/services/credit-service';
import { getFeatureFlagDenial } from '@/server/services/feature-flag-service';
import { AllKeysExhaustedError, NoApiKeyError, fetchWithTimeout, runWithKeyPool } from '@/server/services/vision-service';
import { providerErrorResponse } from '@/server/services/route-helpers';

export const maxDuration = 60;

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function buildPrompt(eventTitle: string, eventCategory: string, eventDate: string) {
  return `You are an expert AI Content Planner and Stock Photography Strategist.
I need a highly actionable content strategy for the following event:
Event: ${eventTitle}
Category: ${eventCategory}
Date: ${eventDate}

Return ONLY a valid raw JSON object with this exact structure:
{
  "stock_ideas": ["Professional description of what photo to take/buy 1", "Idea 2", "Idea 3"],
  "uploader_insight": {
    "orientation": "Vertical or Horizontal",
    "content_style": "Minimalist, Lifestyle, Flat-lay, Corporate, etc.",
    "advice": "Short sentence on why this style works best for this specific event."
  },
  "keywords": ["trending keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"],
  "prompts": ["Cinematic lighting, 8k, bokeh, highly detailed image prompt 1", "Prompt 2"],
  "captions": ["Engaging social media caption with 3 hashtags", "Caption 2"]
}`;
}

function createProviderError(data: { error?: { message?: string }; message?: string }, provider: string, status: number) {
  const error = new Error(data.error?.message || data.message || `${provider} error ${status}`);
  (error as Error & { status?: number }).status = status;
  return error;
}

async function requestChatCompletion(provider: string, model: string, apiKey: string, prompt: string, timeoutMs: number) {
  const endpoints: Record<string, { url: string; headers: Record<string, string> }> = {
    Groq: { url: 'https://api.groq.com/openai/v1/chat/completions', headers: { Authorization: `Bearer ${apiKey}` } },
    OpenAI: { url: 'https://api.openai.com/v1/chat/completions', headers: { Authorization: `Bearer ${apiKey}` } },
    OpenRouter: {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://mcustock.ai', 'X-Title': 'MCUSTOCK AI' },
    },
    'Mistral AI': { url: 'https://api.mistral.ai/v1/chat/completions', headers: { Authorization: `Bearer ${apiKey}` } },
  };
  const endpoint = endpoints[provider];
  if (!endpoint) throw new Error(`Provider "${provider}" is not supported.`);

  const response = await fetchWithTimeout(endpoint.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...endpoint.headers },
    body: JSON.stringify({
      model: model || AI_DEFAULT_MODELS[provider],
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  }, timeoutMs);
  const data = await response.json().catch(() => ({})) as ProviderResponse & { error?: { message?: string } };
  if (!response.ok) throw createProviderError(data, provider, response.status);
  return data.choices?.[0]?.message?.content;
}

async function requestGemini(model: string, apiKey: string, prompt: string, timeoutMs: number) {
  const geminiModel = model && model.includes('gemini') ? model : 'gemini-2.5-flash-lite';
  // Key goes in a header, not the URL, so it never ends up in request logs.
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        ...(geminiModel.includes('2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
  }, timeoutMs);
  const data = await response.json().catch(() => ({})) as ProviderResponse & {
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
  };
  if (!response.ok) throw createProviderError(data, 'Google Gemini', response.status);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw createProviderError({ message: `Gemini returned an empty response (${data.promptFeedback?.blockReason || 'unknown'}).` }, 'Google Gemini', 502);
  return text;
}

export async function POST(req: Request) {
  let creditReceipt: CreditReceipt | null = null;
  const deadlineAt = Date.now() + 52_000;
  let userId: string | null = null;
  let creditReserved = false;
  let usesOwnApiKey = false;
  try {
    userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required to generate event ideas.' }, { status: 401 });
    }
    const featureDenial = await getFeatureFlagDenial(userId, 'ai_tools', 'AI generation');
    if (featureDenial) return NextResponse.json({ success: false, error: featureDenial }, { status: 403 });
    const operationDenial = await getFeatureFlagDenial(userId, 'general_ai', 'Event idea generation');
    if (operationDenial) return NextResponse.json({ success: false, error: operationDenial }, { status: 403 });
    const rateLimitError = await enforceRateLimit(req, userId, {
      limit: 20,
      windowMs: 60 * 1000,
      keyPrefix: 'generate-event-ideas',
    });
    if (rateLimitError) return rateLimitError;

    const body = await req.json() as {
      eventTitle?: string;
      eventCategory?: string;
      eventDate?: string;
      apiKey?: string;
      provider?: string;
      model?: string;
    };
    const { eventTitle, eventCategory, eventDate, provider = 'Groq', model } = body;
    if (typeof eventTitle !== 'string' || !eventTitle.trim()) {
      return NextResponse.json({ success: false, error: 'Event title is required.' }, { status: 400 });
    }
    if (!['Groq', 'Google Gemini', 'OpenAI', 'OpenRouter', 'Mistral AI'].includes(provider)) {
      return NextResponse.json({ success: false, error: `Unsupported AI provider: ${provider}.` }, { status: 400 });
    }

    const suppliedApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    // The user's own keys are always used (server picks them; other providers are tried if one runs out).
    usesOwnApiKey = true;

    const prompt = buildPrompt(eventTitle.trim(), eventCategory || 'General', eventDate || 'Unspecified');
    creditReceipt = (await consumeCredits(userId, 1, 'AI event idea generation', 'general_ai', { usesOwnApiKey })).receipt;
    creditReserved = true;
    const result = await runWithKeyPool(
      { userId, preferredProvider: provider, preferredModel: model || '', clientKey: suppliedApiKey || undefined, deadlineAt },
      async (key, timeoutMs) => {
        const text = key.provider === 'Google Gemini'
          ? await requestGemini(key.model, key.apiKey, prompt, timeoutMs)
          : await requestChatCompletion(key.provider, key.model, key.apiKey, prompt, timeoutMs);
        if (!text) throw createProviderError({ message: `${key.provider} returned an empty response.` }, key.provider, 502);
        return text;
      }
    );
    const resultText = result.text;

    if (!resultText) throw new Error(`${provider} returned an empty response.`);
    const clean = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let data: unknown;
    try {
      data = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw createProviderError({ message: 'The AI returned an invalid answer. Please retry.' }, result.provider, 502);
      data = JSON.parse(match[0]);
    }
    return NextResponse.json({ success: true, data, provider: result.provider, usedFallbackProvider: result.usedFallbackProvider });
  } catch (error) {
    if (creditReserved && userId) {
      await refundCredits(userId, creditReceipt ?? 1, 'Failed AI event idea generation refund', 'general_ai', { usesOwnApiKey })
        .catch((refundError) => console.error('[generate-event-ideas] credit refund error:', refundError));
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
    console.error('AI event planning failed:', error);
    return providerErrorResponse(error);
  }
}