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

  const guestKey = `${key}:guest`;
  const guestValue = localStorage.getItem(guestKey);
  if (guestValue !== null && getStorageScope() !== "guest") {
    localStorage.setItem(scopedKey, guestValue);
    return guestValue;
  }

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
  try {
    const response = await fetch('/api/settings/keys', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const data = await response.json() as { keys?: StoredProviderKey[] };
    return Array.isArray(data.keys) ? data.keys : null;
  } catch {
    return null;
  }
}

export async function saveRemoteProviderKey(key: StoredProviderKey): Promise<{ key: StoredProviderKey } | { error: string }> {
  const token = await ensureAccessToken();
  if (!token) return { error: 'Your session has expired. Please sign in again.' };
  try {
    const response = await fetch('/api/settings/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider: key.provider, key: key.key }),
    });
    const data = await response.json().catch(() => ({})) as { key?: Partial<StoredProviderKey>; error?: string };
    if (!response.ok) return { error: data.error || `API key save failed (${response.status}).` };
    if (!data.key?.id) return { error: 'API key save returned an invalid response.' };
    return { key: { ...key, ...data.key, key: key.key } };
  } catch {
    return { error: 'Network error while saving API key.' };
  }
}

export async function deleteRemoteProviderKey(id: string) {
  const token = await ensureAccessToken();
  if (!token) return false;
  try {
    const response = await fetch('/api/settings/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function syncProviderKeys(): Promise<StoredProviderKey[]> {
  const localKeys = getProviderKeys();
  const remoteKeys = await loadRemoteProviderKeys();

  if (remoteKeys === null) {
    return localKeys;
  }

  // If remote is empty but local has keys, sync local keys up to MongoDB
  if (remoteKeys.length === 0 && localKeys.length > 0) {
    const synced: StoredProviderKey[] = [];
    for (const lk of localKeys) {
      const res = await saveRemoteProviderKey(lk);
      if ('key' in res && res.key) {
        synced.push(res.key);
      } else {
        synced.push(lk);
      }
    }
    saveProviderKeys(synced);
    return synced;
  }

  // If remote has keys, merge them with any unique local keys
  if (remoteKeys.length > 0) {
    const remoteKeySet = new Set(remoteKeys.map((k) => `${k.provider}:${k.key.trim()}`));
    const missingInRemote = localKeys.filter((lk) => !remoteKeySet.has(`${lk.provider}:${lk.key.trim()}`));

    const merged = [...remoteKeys];
    for (const m of missingInRemote) {
      const res = await saveRemoteProviderKey(m);
      if ('key' in res && res.key) {
        merged.push(res.key);
      } else {
        merged.push(m);
      }
    }
    saveProviderKeys(merged);
    return merged;
  }

  // If both are empty
  saveProviderKeys([]);
  return [];
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
