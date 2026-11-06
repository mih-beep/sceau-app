ALTER TABLE seals ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
UPDATE seals SET visibility = CASE WHEN is_public = true THEN 'public' ELSE 'private' END;

CREATE TABLE IF NOT EXISTS friendships (
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (requester_id, addressee_id)
);
