-- Supabase / PostgreSQL schema for migrating from MongoDB
-- Stores original MongoDB ObjectId hex strings in TEXT "id" columns to preserve existing references.

-- Users table (preserve Mongo _id as text id)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metadata history table (preserve Mongo _id as text id)
CREATE TABLE IF NOT EXISTS public.metadata_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metadata_history_user_id ON public.metadata_history (user_id);
CREATE INDEX IF NOT EXISTS idx_metadata_history_created_at ON public.metadata_history (created_at DESC);

-- GIN index for keywords array to speed up searches
CREATE INDEX IF NOT EXISTS idx_metadata_history_keywords_gin ON public.metadata_history USING GIN (keywords);

-- Helpful note: This schema stores Mongo ObjectId values as text in the `id` columns
-- to make the migration non-invasive: application code that expects `._id` can
-- continue to receive the same string values (API handlers can echo `id` into `_id`).
