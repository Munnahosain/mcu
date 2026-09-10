export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  signedInAt: number;
};

const USER_KEY = "mcustock_user";
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string) => {
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export async function ensureAccessToken() {
  if (accessToken) return accessToken;
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json() as { accessToken?: string };
    if (response.ok && data.accessToken) {
      accessToken = data.accessToken;
      return accessToken;
    }
  } catch {
    // The user may be logged out or the refresh cookie may be expired.
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
