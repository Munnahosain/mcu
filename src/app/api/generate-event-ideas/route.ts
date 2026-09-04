import { NextResponse } from 'next/server';
import { AI_DEFAULT_MODELS } from '@/lib/ai-models';

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

async function requestChatCompletion(provider: string, model: string, apiKey: string, prompt: string) {
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

  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...endpoint.headers },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });
  const data = await response.json().catch(() => ({})) as ProviderResponse & { error?: { message?: string } };
  if (!response.ok) throw createProviderError(data, provider, response.status);
  return data.choices?.[0]?.message?.content;
}

async function requestGemini(model: string, apiKey: string, prompt: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }),
  });
  const data = await response.json().catch(() => ({})) as ProviderResponse & {
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
  };
  if (!response.ok) throw createProviderError(data, 'Google Gemini', response.status);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || data.promptFeedback?.blockReason;
}

export async function POST(req: Request) {
  try {
    const { eventTitle, eventCategory, eventDate, apiKey, provider = 'Groq', model } = await req.json();
    if (!apiKey) return NextResponse.json({ success: false, error: 'No API key provided.' }, { status: 400 });

    const selectedModel = model || AI_DEFAULT_MODELS[provider] || '';
    const prompt = buildPrompt(eventTitle, eventCategory, eventDate);
    const resultText = provider === 'Google Gemini'
      ? await requestGemini(selectedModel, apiKey, prompt)
      : await requestChatCompletion(provider, selectedModel, apiKey, prompt);

    if (!resultText) throw new Error(`${provider} returned an empty response.`);
    const clean = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return NextResponse.json({ success: true, data: JSON.parse(clean) });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('AI event planning failed:', err);
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    return NextResponse.json({ success: false, error: err.message || 'AI Generation failed' }, { status });
  }
}