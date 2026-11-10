CREATE TABLE IF NOT EXISTS oracle_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  captures_used INTEGER DEFAULT 0,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_user ON oracle_queries(user_id, created_at DESC);
