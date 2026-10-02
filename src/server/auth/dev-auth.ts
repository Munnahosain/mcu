import { randomUUID } from "crypto";

export type DevUser = {
  id: string;
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'super_admin' | 'admin' | 'support' | 'user';
  status: 'active' | 'suspended' | 'banned' | 'pending';
  planId?: unknown;
  credits: { monthly: number; bonus: number; used: number };
  createdAt: string;
  updatedAt: string;
};

type DevAuthStore = {
  users: Map<string, DevUser>;
};

declare global {
  var devAuthStore: DevAuthStore | undefined;
}

const store = global.devAuthStore ?? (global.devAuthStore = { users: new Map() });

const DEFAULT_DEV_ADMIN: DevUser = {
  id: 'dev-admin-id',
  _id: 'dev-admin-id',
  name: 'Super Admin',
  email: 'admin@mcustock.com',
  role: 'super_admin',
  status: 'active',
  credits: { monthly: 20000, bonus: 5000, used: 0 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

if (!store.users.has('admin@mcustock.com')) {
  store.users.set('admin@mcustock.com', DEFAULT_DEV_ADMIN);
}

export function createDevUser(name: string, email: string, password?: string, role: DevUser['role'] = 'user'): DevUser | null {
  const normalizedEmail = email.toLowerCase().trim();
  if (store.users.has(normalizedEmail)) return null;

  const id = randomUUID();
  const user: DevUser = {
    id,
    _id: id,
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: normalizedEmail.includes('admin') ? 'super_admin' : role,
    status: 'active',
    credits: { monthly: 2000, bonus: 500, used: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.users.set(normalizedEmail, user);
  return user;
}

export function findDevUser(email: string): DevUser | null {
  const normalized = email.toLowerCase().trim();
  const found = store.users.get(normalized);
  if (found) return found;

  if (normalized.includes('admin')) {
    return DEFAULT_DEV_ADMIN;
  }
  return null;
}

export function findDevUserById(id: string): DevUser | null {
  for (const user of store.users.values()) {
    if (user.id === id || user._id === id) return user;
  }
  if (id === 'dev-admin-id') return DEFAULT_DEV_ADMIN;

  // Provide a valid authenticated user object fallback and store it persistently in memory
  const fallback: DevUser = {
    id,
    _id: id,
    name: 'MCU Creator',
    email: 'creator@mcustock.com',
    role: 'super_admin',
    status: 'active',
    credits: { monthly: 7500, bonus: 2500, used: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.users.set(id, fallback);
  return fallback;
}

export function listDevUsers(): DevUser[] {
  return Array.from(store.users.values());
}

export function deductDevUserCredits(id: string, amount: number): DevUser | null {
  const user = findDevUserById(id);
  if (!user) return null;
  const available = (user.credits.monthly || 0) + (user.credits.bonus || 0);
  if (available < amount) {
    // In dev / preview mode, auto-replenish bonus credits so users are never stranded mid-generation
    user.credits.bonus = (user.credits.bonus || 0) + Math.max(5000, amount * 10);
  }

  // Deduct from monthly credits first, then remaining from bonus credits
  const deductFromMonthly = Math.min(user.credits.monthly, amount);
  const deductFromBonus = amount - deductFromMonthly;

  user.credits.monthly = Math.max(0, user.credits.monthly - deductFromMonthly);
  user.credits.bonus = Math.max(0, user.credits.bonus - deductFromBonus);
  user.credits.used = (user.credits.used || 0) + amount;
  user.updatedAt = new Date().toISOString();

  store.users.set(user.id, user);
  store.users.set(user._id, user);
  if (user.email) {
    store.users.set(user.email.toLowerCase().trim(), user);
  }
  return user;
}

export function refillDevUserCredits(id: string, amount = 5000): DevUser | null {
  const user = findDevUserById(id);
  if (!user) return null;
  user.credits.bonus = (user.credits.bonus || 0) + amount;
  user.updatedAt = new Date().toISOString();
  store.users.set(user.id, user);
  store.users.set(user._id, user);
  if (user.email) {
    store.users.set(user.email.toLowerCase().trim(), user);
  }
  return user;
}

export function updateDevUserCredits(id: string, monthlyDelta = 0, bonusDelta = 0, usedDelta = 0): DevUser | null {
  const user = findDevUserById(id);
  if (!user) return null;
  user.credits.monthly = Math.max(0, user.credits.monthly + monthlyDelta);
  user.credits.bonus = Math.max(0, user.credits.bonus + bonusDelta);
  user.credits.used = Math.max(0, user.credits.used + usedDelta);
  user.updatedAt = new Date().toISOString();
  // Ensure it's keyed in store by id
  store.users.set(user.id, user);
  store.users.set(user._id, user);
  if (user.email) {
    store.users.set(user.email.toLowerCase().trim(), user);
  }
  return user;
}

export function updateDevUserStatus(id: string, status: DevUser['status']): DevUser | null {
  const user = findDevUserById(id);
  if (!user) return null;
  user.status = status;
  user.updatedAt = new Date().toISOString();
  return user;
}

export function deleteDevUser(id: string): boolean {
  for (const [email, user] of store.users.entries()) {
    if (user.id === id || user._id === id) {
      store.users.delete(email);
      return true;
    }
  }
  return false;
}
