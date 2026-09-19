/**
 * Safe client-side storage with in-memory cache and IndexedDB persistence.
 * Solves sessionStorage 5MB quota errors for large vector / SVG / 3D files
 * and ensures full persistence across navigation between Splitter and 3D Studio.
 */

const memoryCache = new Map<string, unknown>();

const DB_NAME = "mcustock_client_db";
const DB_VERSION = 1;
const STORE_NAME = "workspace_store";

function getIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = (req.result as T) ?? null;
        if (val !== null) memoryCache.set(key, val);
        resolve(val);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function idbGetSync<T>(key: string): T | null {
  return memoryCache.has(key) ? (memoryCache.get(key) as T) : null;
}

export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  memoryCache.set(key, value);
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function idbRemove(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

// SessionStorage wrappers with in-memory fallback if quota exceeds
export function readSessionValue<T>(key: string): T | null {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  try {
    const value = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    if (value) {
      const parsed = JSON.parse(value) as T;
      memoryCache.set(key, parsed);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSessionValue<T>(key: string, value: T): boolean {
  memoryCache.set(key, value);
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
    return true;
  } catch {
    // SessionStorage quota exceeded, but value is safely preserved in memoryCache!
    return true;
  }
}

export function removeSessionValue(key: string): void {
  memoryCache.delete(key);
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}
