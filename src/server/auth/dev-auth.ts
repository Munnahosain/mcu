import { randomUUID } from "crypto";

type DevUser = {
  id: string;
  name: string;
  email: string;
  password: string;
};

type DevAuthStore = {
  users: Map<string, DevUser>;
};

declare global {
  var devAuthStore: DevAuthStore | undefined;
}

const store = global.devAuthStore ?? (global.devAuthStore = { users: new Map() });

export function createDevUser(name: string, email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  if (store.users.has(normalizedEmail)) return null;
  const user = { id: randomUUID(), name: name.trim(), email: normalizedEmail, password };
  store.users.set(normalizedEmail, user);
  return user;
}

export function findDevUser(email: string) {
  return store.users.get(email.toLowerCase().trim()) ?? null;
}

export function findDevUserById(id: string) {
  for (const user of store.users.values()) {
    if (user.id === id) return user;
  }
  return null;
}
