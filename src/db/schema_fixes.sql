-- Colonnes manquantes sur seals
ALTER TABLE seals ADD COLUMN IF NOT EXISTS ots_proof TEXT;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS ots_submitted_at TIMESTAMPTZ;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS ots_upgraded_at TIMESTAMPTZ;

-- Colonnes manquantes sur pacts
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS pact_hash BYTEA;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS ots_proof TEXT;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS scelle_at TIMESTAMPTZ;

-- Journal des accès
CREATE TABLE IF NOT EXISTS access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id UUID NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view','download')),
  context TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_seal ON access_log(seal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_viewer ON access_log(viewer_id);
