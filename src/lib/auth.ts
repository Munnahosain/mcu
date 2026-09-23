export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  signedInAt: number;
};

const USER_KEY = "mcustock_user";
let accessToken: string | null = null;
let logoutRequested = false;

export function disableGoogleAutoSelect() {
  if (typeof window === "undefined") return;
  const googleApi = (window as Window & { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google;
  googleApi?.accounts?.id?.disableAutoSelect?.();
  document.cookie = "g_state=; Max-Age=0; path=/";
}

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string) => {
  logoutRequested = false;
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export async function ensureAccessToken() {
  if (logoutRequested) return null;
  if (accessToken) return accessToken;
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json() as { accessToken?: string; user?: Omit<AuthUser, 'signedInAt'> };
    if (!logoutRequested && response.ok && data.accessToken) {
      accessToken = data.accessToken;
      if (data.user) {
        setAuthUser({ ...data.user, signedInAt: Date.now() });
      }
      return accessToken;
    }
  } catch {
    // The user may be logged out or the refresh cookie may be expired.
  }
  return null;
}

export async function refreshAuthSession() {
  if (logoutRequested) return null;
  try {
    const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    const data = await response.json() as { accessToken?: string; user?: Omit<AuthUser, 'signedInAt'> };
    if (!logoutRequested && response.ok && data.accessToken && data.user) {
      accessToken = data.accessToken;
      setAuthUser({ ...data.user, signedInAt: Date.now() });
      return data.user;
    }
  } catch {
    // Keep the current session when the refresh endpoint is temporarily unavailable.
  }
  return null;
}

export const getAuthUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const setAuthUser = (user: AuthUser): boolean => {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return true;
  } catch {
    return false;
  }
};

export const clearAuthUser = () => {
  if (typeof window === "undefined") return;
  logoutRequested = true;
  localStorage.removeItem(USER_KEY);
  clearAccessToken();
};

export const getDownloadsKey = (email?: string | null) => {
  const safeEmail = (email || "guest").toLowerCase().trim();
  return `mcustock_downloads_${safeEmail}`;
};

export async function signInWithGoogle(): Promise<void> {
  throw new Error("Google sign-in is not enabled for MongoDB authentication.");
}
