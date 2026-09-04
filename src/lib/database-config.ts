export type DatabaseProvider = 'mongodb' | 'supabase';

export const DATABASE_PROVIDER = ((
  process.env.NEXT_PUBLIC_DATABASE_PROVIDER ?? process.env.DATABASE_PROVIDER ?? 'mongodb'
).toLowerCase() as DatabaseProvider);

export function getDatabaseProvider(): DatabaseProvider {
  return DATABASE_PROVIDER === 'supabase' ? 'supabase' : 'mongodb';
}

export function hasMongoDbConfig(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key);
}
