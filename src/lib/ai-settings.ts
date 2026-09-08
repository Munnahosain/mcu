import { AI_DEFAULT_MODELS, AI_PROVIDERS } from "@/lib/ai-models";
import { ensureAccessToken } from "@/lib/auth";

export type StoredProviderKey = {
  id: string;
  key: string;
  provider: string;
};

const KEYS_STORAGE = "mcustock_provider_keys";
const LEGACY_KEYS_STORAGE = "generator_api_keys";
const OLD_KEYS_STORAGE = "promptgen_keys";
const MODELS_STORAGE = "mcustock_provider_models";
const ACTIVE_PROVIDER_STORAGE = "mcustock_active_provider";

function getStorageScope() {
  if (typeof window === "undefined") return "guest";
  try {
    const user = JSON.parse(localStorage.getItem("mcustock_user") || "null") as { id?: string; email?: string } | null;
    return user?.id || user?.email?.toLowerCase().trim() || "guest";
  } catch {
    return "guest";
  }
}

function getScopedKey(key: string) {
  return `${key}:${encodeURIComponent(getStorageScope())}`;
}

function getScopedValue(key: string) {
  const scopedKey = getScopedKey(key);
  const scopedValue = localStorage.getItem(scopedKey);
  if (scopedValue !== null) return scopedValue;

  const legacyValue = localStorage.getItem(key);
  if (legacyValue !== null && getStorageScope() !== "guest") {
    localStorage.setItem(scopedKey, legacyValue);
    localStorage.removeItem(key);
    return legacyValue;
  }
  return null;
}

export function getProviderKeys(): StoredProviderKey[] {
  if (typeof window === "undefined") return [];
  const raw = getScopedValue(KEYS_STORAGE) || getScopedValue(LEGACY_KEYS_STORAGE);
  const oldRaw = getScopedValue(OLD_KEYS_STORAGE);
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
  return normalized;
}

export function saveProviderKeys(keys: StoredProviderKey[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getScopedKey(KEYS_STORAGE), JSON.stringify(keys));
  localStorage.setItem(getScopedKey(LEGACY_KEYS_STORAGE), JSON.stringify(keys));
}

export async function loadRemoteProviderKeys(): Promise<StoredProviderKey[] | null> {
  const token = await ensureAccessToken();
  if (!token) return null;
  const response = await fetch('/api/settings/keys', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const data = await response.json() as { keys?: StoredProviderKey[] };
  return Array.isArray(data.keys) ? data.keys : null;
}

export async function saveRemoteProviderKey(key: StoredProviderKey) {
  const token = await ensureAccessToken();
  if (!token) return null;
  const response = await fetch('/api/settings/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ provider: key.provider, key: key.key }),
  });
  return response.ok;
}

export async function deleteRemoteProviderKey(id: string) {
  const token = await ensureAccessToken();
  if (!token) return false;
  const response = await fetch('/api/settings/keys', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  return response.ok;
}

export function getProviderModels(): Record<string, string> {
  if (typeof window === "undefined") return AI_DEFAULT_MODELS;
  try {
    const stored = JSON.parse(getScopedValue(MODELS_STORAGE) || "{}") as Record<string, string>;
    return Object.fromEntries(Object.entries(AI_DEFAULT_MODELS).map(([provider, fallback]) => {
      const selected = stored[provider];
      const valid = AI_PROVIDERS[provider]?.some(model => model.id === selected);
      return [provider, valid ? selected : fallback];
    }));
  } catch {
    return AI_DEFAULT_MODELS;
  }
}

export function saveProviderModel(provider: string, model: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getScopedKey(MODELS_STORAGE), JSON.stringify({ ...getProviderModels(), [provider]: model }));
}

export function getActiveProvider(): string {
  if (typeof window === "undefined") return "Groq";
  return getScopedValue(ACTIVE_PROVIDER_STORAGE) || "Groq";
}

export function saveActiveProvider(provider: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getScopedKey(ACTIVE_PROVIDER_STORAGE), provider);
}
