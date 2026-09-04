import { AI_DEFAULT_MODELS } from "@/lib/ai-models";

export type StoredProviderKey = {
  id: string;
  key: string;
  provider: string;
};

const KEYS_STORAGE = "mcustock_provider_keys";
const LEGACY_KEYS_STORAGE = "generator_api_keys";
const OLD_KEYS_STORAGE = "promptgen_keys";
const MODELS_STORAGE = "mcustock_provider_models";

export function getProviderKeys(): StoredProviderKey[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEYS_STORAGE) || localStorage.getItem(LEGACY_KEYS_STORAGE);
  const oldRaw = localStorage.getItem(OLD_KEYS_STORAGE);
  const parsed: unknown[] = raw ? JSON.parse(raw) : [];
  const oldParsed: unknown[] = oldRaw ? JSON.parse(oldRaw) : [];
  const keys = [...parsed, ...oldParsed];
  const normalized = keys.flatMap((entry, index) => {
    if (typeof entry === "string" && entry.trim()) {
      return [{ id: `legacy-${index}`, key: entry.trim(), provider: "Groq" }];
    }
    if (entry && typeof entry === "object" && "key" in entry && typeof entry.key === "string") {
      const item = entry as Partial<StoredProviderKey>;
      const key = item.key;
      return key ? [{ id: item.id || `key-${index}`, key, provider: item.provider || "Groq" }] : [];
    }
    return [];
  });
  return normalized.filter((item, index, list) => list.findIndex((candidate) => candidate.provider === item.provider) === index);
}

export function saveProviderKeys(keys: StoredProviderKey[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  localStorage.setItem(LEGACY_KEYS_STORAGE, JSON.stringify(keys));
}

export function getProviderModels(): Record<string, string> {
  if (typeof window === "undefined") return AI_DEFAULT_MODELS;
  try {
    return { ...AI_DEFAULT_MODELS, ...JSON.parse(localStorage.getItem(MODELS_STORAGE) || "{}") };
  } catch {
    return AI_DEFAULT_MODELS;
  }
}

export function saveProviderModel(provider: string, model: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODELS_STORAGE, JSON.stringify({ ...getProviderModels(), [provider]: model }));
}
