/*
Safe MongoDB -> Supabase (Postgres) migration script scaffold

Usage:
  - Set env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role key must be server-only)
  - From repo root run with ts-node or compile first. Example with ts-node:
      npx ts-node scripts/migrate-mongodb-to-supabase.ts

Notes:
  - Script is read-only against MongoDB (uses existing connectToDatabase helper and Mongoose models).
  - Preserves Mongo _id as text in Postgres `id` columns to minimize application changes.
  - Works in batches and is idempotent: it queries Supabase for existing ids in each batch and only inserts missing rows.
  - Logs statistics and failures.

Customize transform logic if additional fields or collections exist.
*/

import { createClient } from '@supabase/supabase-js';
import { connectToDatabase } from '../src/lib/mongodb';
import { User } from '../src/lib/models/User';
import { MetadataHistory } from '../src/lib/models/MetadataHistory';

type Stats = {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  validationErrors: number;
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Aborting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateCollection<TDoc, TRow>(params: {
  cursor: AsyncIterable<TDoc>;
  transform: (doc: TDoc) => TRow | null;
  table: string;
  batchSize?: number;
}) {
  const { cursor, transform, table, batchSize = 100 } = params;
  const stats: Stats = { total: 0, migrated: 0, skipped: 0, failed: 0, validationErrors: 0 };

  let buffer: TRow[] = [];

  async function flush() {
    if (buffer.length === 0) return;
    const ids = (buffer as any[]).map((r) => (r as any).id).filter(Boolean);
    if (ids.length === 0) {
      // Nothing to insert
      buffer = [];
      return;
    }

    const DRY_RUN = process.env.DRY_RUN === 'true';

    // Query Supabase for existing ids in this batch
    const { data: existing, error: selectErr } = await supabase
      .from(table)
      .select('id')
      .in('id', ids as any[]);

    if (selectErr) {
      console.error(`Error checking existing ids for table ${table}:`, selectErr);
      // Proceed to attempt insert (may fail on conflicts)
    }

    const existingIds = new Set(((existing as any[]) || []).map((r) => r.id));

    const toInsert = buffer.filter((r: any) => !existingIds.has(r.id));
    stats.skipped += buffer.length - toInsert.length;

    if (toInsert.length > 0) {
      if (DRY_RUN) {
        console.log(`DRY RUN: would insert ${toInsert.length} rows into ${table}. Sample ids:`,
          toInsert.slice(0, 10).map((r: any) => r.id));
        // Simulate successful migration counts without making changes
        stats.migrated += toInsert.length;
      } else {
        const { error: insertErr } = await supabase.from(table).insert(toInsert);
        if (insertErr) {
          console.error(`Failed to insert batch into ${table}:`, insertErr);
          stats.failed += toInsert.length;
        } else {
          stats.migrated += toInsert.length;
        }
      }
    }

    buffer = [];
  }

  try {
    for await (const doc of cursor) {
      stats.total++;
      try {
        const row = transform(doc as TDoc);
        if (!row) {
          stats.validationErrors++;
          continue;
        }
        buffer.push(row);
      } catch (e) {
        console.error('Transform error for doc:', e);
        stats.validationErrors++;
      }

      if (buffer.length >= batchSize) {
        await flush();
      }
    }

    // final flush
    await flush();
  } catch (e) {
    console.error(`Cursor iteration failed for table ${table}:`, e);
  }

  return stats;
}

async function migrateUsers() {
  console.log('Migrating users...');
  // Use a cursor to avoid loading entire collection into memory
  const cursor = User.find().lean().cursor();

  const transform = (doc: any) => {
    if (!doc || !doc._id || !doc.email || !doc.password) return null;
    return {
      id: doc._id?.toString(),
      name: doc.name || '',
      email: doc.email,
      password: doc.password,
      created_at: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    } as any;
  };

  const stats = await migrateCollection({ cursor, transform, table: 'users', batchSize: 200 });
  console.log('Users migration stats:', stats);
  return stats;
}

async function migrateMetadataHistory() {
  console.log('Migrating metadata_history...');
  const cursor = MetadataHistory.find().lean().cursor();

  const transform = (doc: any) => {
    if (!doc || !doc._id || !doc.userId || !doc.filename || !doc.title) return null;

    // keywords -> text[] in Postgres; ensure array of strings
    const keywords = Array.isArray(doc.keywords) ? doc.keywords.map(String) : [];

    return {
      id: doc._id?.toString(),
      user_id: doc.userId?.toString(),
      filename: doc.filename,
      title: doc.title,
      description: doc.description || null,
      keywords: keywords,
      category: doc.category || null,
      created_at: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    } as any;
  };

  const stats = await migrateCollection({ cursor, transform, table: 'metadata_history', batchSize: 200 });
  console.log('Metadata history migration stats:', stats);
  return stats;
}

async function main() {
  console.log('Starting migration: MongoDB -> Supabase');
  try {
    await connectToDatabase();
    console.log('Connected to MongoDB');
  } catch (e) {
    console.error('Failed to connect to MongoDB:', e);
    process.exit(1);
  }

  try {
    const userStats = await migrateUsers();
    const metaStats = await migrateMetadataHistory();

    console.log('\nMigration complete. Summary:');
    console.log('Users:', userStats);
    console.log('MetadataHistory:', metaStats);
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    console.log('Migration finished (disconnecting)');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Unhandled error in migration:', e);
  process.exit(1);
});
