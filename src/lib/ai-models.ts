export type AIModel = {
  id: string;
  label: string;
  badge?: string;
};

export const AI_PROVIDERS: Record<string, AIModel[]> = {
  Groq: [
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout Vision", badge: "Fast" },
    { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick Vision", badge: "Pro" },
  ],
  "Google Gemini": [
    { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", badge: "New" },
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", badge: "Stable" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", badge: "Stable" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "Fast" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: "Pro" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  OpenAI: [
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini Vision", badge: "Fast" },
    { id: "gpt-4.1", label: "GPT-4.1 Vision", badge: "Pro" },
    { id: "gpt-4o", label: "GPT-4o Vision" },
  ],
  "Mistral AI": [
    { id: "pixtral-large-latest", label: "Pixtral Large", badge: "Pro" },
    { id: "pixtral-12b-2409", label: "Pixtral 12B" },
  ],
  OpenRouter: [
    { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash", badge: "New" },
    { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash", badge: "Stable" },
    { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", badge: "Stable" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "Fast" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: "Pro" },
    { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
    { id: "anthropic/claude-3.7-sonnet", label: "Claude 3.7 Sonnet" },
  ],
};

export const AI_PROVIDER_NAMES = Object.keys(AI_PROVIDERS);

export const AI_DEFAULT_MODELS: Record<string, string> = Object.fromEntries(
  Object.entries(AI_PROVIDERS).map(([provider, models]) => [provider, models[0].id])
);
