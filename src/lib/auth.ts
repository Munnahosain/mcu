import { supabase } from "./supabase";
import { getDatabaseProvider, hasSupabaseConfig } from "./database-config";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  signedInAt: number;
};

const USER_KEY = "mcustock_user";

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

  if (getDatabaseProvider() === "supabase" && hasSupabaseConfig()) {
    void supabase.auth.signOut();
  }
};

export const getDownloadsKey = (email?: string | null) => {
  const safeEmail = (email || "guest").toLowerCase().trim();
  return `mcustock_downloads_${safeEmail}`;
};

export async function signInWithSupabase(email: string, password: string): Promise<AuthUser | null> {
  if (getDatabaseProvider() !== "supabase" || !hasSupabaseConfig()) {
    return null;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message || "Invalid email or password");
  }

  const authUser: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? email,
    name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || "User",
    signedInAt: Date.now(),
  };

  setAuthUser(authUser);
  return authUser;
}

export async function signUpWithSupabase(name: string, email: string, password: string): Promise<AuthUser | null> {
  if (getDatabaseProvider() !== "supabase" || !hasSupabaseConfig()) {
    return null;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Failed to create account");
  }

  const authUser: AuthUser = {
    id: data.user.id,
    email: data.user.email ?? email,
    name: data.user.user_metadata?.full_name || name,
    signedInAt: Date.now(),
  };

  setAuthUser(authUser);
  return authUser;
}
