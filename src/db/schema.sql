CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL UNIQUE,
  pubkey BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash BYTEA NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_seal UNIQUE (hash, author_id)
);