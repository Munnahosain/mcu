import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { connectToDatabase } from './mongodb';
import { User } from './models/User';
import { MetadataHistory } from './models/MetadataHistory';
import { createDevUser, findDevUser } from './dev-auth';
import { verifyPassword } from './hash';
import { getDatabaseProvider, hasMongoDbConfig, hasSupabaseConfig } from './database-config';

export { getDatabaseProvider, hasMongoDbConfig, hasSupabaseConfig } from './database-config';
export type { DatabaseProvider } from './database-config';

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }

  return createClient(url, key);
}

export async function tryDevLogin(email: string, password: string) {
  if (getDatabaseProvider() !== 'mongodb' || hasMongoDbConfig()) {
    return null;
  }

  const devUser = findDevUser(email);
  if (!devUser || !verifyPassword(password, devUser.password)) {
    return null;
  }

  return { id: devUser.id, name: devUser.name, email: devUser.email };
}

export async function tryDevSignup(name: string, email: string, password: string) {
  if (getDatabaseProvider() !== 'mongodb' || hasMongoDbConfig()) {
    return null;
  }

  const devUser = createDevUser(name, email, password);
  return devUser ? { id: devUser.id, name: devUser.name, email: devUser.email } : null;
}

export async function findUserByEmail(email: string) {
  const provider = getDatabaseProvider();

  if (provider === 'mongodb') {
    if (!hasMongoDbConfig()) return null;
    await connectToDatabase();
    return await User.findOne({ email }).lean();
  }

  if (!hasSupabaseConfig()) return null;
  const { data, error } = await getSupabaseClient()
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createUser({ name, email, password }: { name: string; email: string; password: string }) {
  const provider = getDatabaseProvider();

  if (provider === 'mongodb') {
    if (!hasMongoDbConfig()) {
      const created = createDevUser(name, email, password);
      return created ? { _id: created.id, name: created.name, email: created.email, password: created.password } : null;
    }

    await connectToDatabase();
    return await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password,
    });
  }

  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured. Set DATABASE_PROVIDER=supabase and configure Supabase env vars.');
  }

  const supabase = getSupabaseClient();
  const userId = randomUUID();
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listUserHistory(userId: string) {
  const provider = getDatabaseProvider();

  if (provider === 'mongodb') {
    if (!hasMongoDbConfig()) return [];
    await connectToDatabase();
    return await MetadataHistory.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  if (!hasSupabaseConfig()) return [];
  const { data, error } = await getSupabaseClient()
    .from('metadata_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createHistoryItem(input: {
  userId: string;
  filename: string;
  title: string;
  description?: string;
  keywords?: string[];
  category?: string;
}) {
  const provider = getDatabaseProvider();

  if (provider === 'mongodb') {
    if (!hasMongoDbConfig()) {
      return null;
    }

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

  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured. Set DATABASE_PROVIDER=supabase and configure Supabase env vars.');
  }

  const supabase = getSupabaseClient();
  const payload = {
    id: randomUUID(),
    user_id: input.userId,
    filename: input.filename,
    title: input.title,
    description: input.description || null,
    keywords: Array.isArray(input.keywords) ? input.keywords : [],
    category: input.category || null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('metadata_history').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHistoryItem(id: string) {
  const provider = getDatabaseProvider();

  if (provider === 'mongodb') {
    if (!hasMongoDbConfig()) return false;
    await connectToDatabase();
    const result = await MetadataHistory.findByIdAndDelete(id);
    return Boolean(result);
  }

  if (!hasSupabaseConfig()) return false;
  const { error } = await getSupabaseClient().from('metadata_history').delete().eq('id', id);
  if (error) throw error;
  return true;
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
  return `DATABASE_PROVIDER=${getDatabaseProvider()}`;
}
