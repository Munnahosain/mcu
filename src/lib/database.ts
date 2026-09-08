import { connectToDatabase } from './mongodb';
import { User } from './models/User';
import { MetadataHistory } from './models/MetadataHistory';
import { createDevUser, findDevUser } from './dev-auth';
import { verifyPassword } from './hash';
import { hasMongoDbConfig } from './database-config';

export { getDatabaseProvider, hasMongoDbConfig } from './database-config';
export type { DatabaseProvider } from './database-config';

export async function tryDevLogin(email: string, password: string) {
  if (hasMongoDbConfig()) {
    return null;
  }

  const devUser = findDevUser(email);
  if (!devUser || !verifyPassword(password, devUser.password)) {
    return null;
  }

  return { id: devUser.id, name: devUser.name, email: devUser.email };
}

export async function tryDevSignup(name: string, email: string, password: string) {
  if (hasMongoDbConfig()) {
    return null;
  }

  const devUser = createDevUser(name, email, password);
  return devUser ? { id: devUser.id, name: devUser.name, email: devUser.email } : null;
}

export async function findUserByEmail(email: string) {
  if (!hasMongoDbConfig()) return null;
  await connectToDatabase();
  return await User.findOne({ email }).lean();
}

export async function findUserById(id: string) {
  if (!hasMongoDbConfig()) return null;
  await connectToDatabase();
  return await User.findById(id).lean();
}

export async function createUser({ name, email, password }: { name: string; email: string; password: string }) {
  if (!hasMongoDbConfig()) {
    const created = createDevUser(name, email, password);
    return created ? { _id: created.id, name: created.name, email: created.email, password: created.password } : null;
  }

  await connectToDatabase();
  return await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password });
}

export async function listUserHistory(userId: string) {
  if (!hasMongoDbConfig()) return [];
  await connectToDatabase();
  return await MetadataHistory.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function createHistoryItem(input: {
  userId: string;
  filename: string;
  title: string;
  description?: string;
  keywords?: string[];
  category?: string;
}) {
  if (!hasMongoDbConfig()) return null;

  await connectToDatabase();
  return await MetadataHistory.create({
    userId: input.userId,
    filename: input.filename,
    title: input.title,
    description: input.description || '',
    keywords: Array.isArray(input.keywords) ? input.keywords : [],
    category: input.category || '',
  });
}

export async function deleteHistoryItem(id: string, userId: string) {
  if (!hasMongoDbConfig()) return false;
  await connectToDatabase();
  const result = await MetadataHistory.findOneAndDelete({ _id: id, userId });
  return Boolean(result);
}

export async function clearUserHistory(userId: string) {
  if (!hasMongoDbConfig()) return 0;
  await connectToDatabase();
  const result = await MetadataHistory.deleteMany({ userId });
  return result.deletedCount ?? 0;
}

export function normalizeUserRecord(user: Record<string, unknown> | null) {
  if (!user) return null;
  const id = user._id ? String(user._id) : String((user.id ?? '') as string);
  return {
    id,
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
  };
}

export function normalizeHistoryItem(item: Record<string, unknown> | null) {
  if (!item) return null;
  const keywords = Array.isArray(item.keywords) ? item.keywords.map(String) : [];
  return {
    _id: item._id ? String(item._id) : String((item.id ?? '') as string),
    userId: item.userId ? String(item.userId) : String((item.user_id ?? '') as string),
    filename: String(item.filename ?? ''),
    title: String(item.title ?? ''),
    description: String(item.description ?? ''),
    keywords,
    category: String(item.category ?? ''),
    createdAt: String(item.createdAt ?? item.created_at ?? new Date().toISOString()),
  };
}

export function getDatabaseProviderDescription() {
  return 'DATABASE_PROVIDER=mongodb';
}
