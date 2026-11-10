-- ============================================================
-- SCEAU — Schéma Master (idempotent, safe to run multiple times)
-- ============================================================

-- 1. USERS (déjà existante, on ajoute les colonnes manquantes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expiry TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'createur';
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS open_to_collaboration BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_changes_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_history JSONB DEFAULT '[]'::jsonb;

-- 2. SEALS (déjà existante)
ALTER TABLE seals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Art';
ALTER TABLE seals ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS is_hosted BOOLEAN DEFAULT FALSE;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
ALTER TABLE seals ADD COLUMN IF NOT EXISTS is_flash BOOLEAN DEFAULT FALSE;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS is_mystery BOOLEAN DEFAULT FALSE;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS unlock_likes INTEGER DEFAULT 0;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS is_ephemeral BOOLEAN DEFAULT FALSE;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS reveal_at TIMESTAMPTZ;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS ots_proof TEXT;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS ots_submitted_at TIMESTAMPTZ;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS ots_upgraded_at TIMESTAMPTZ;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS challenge_id UUID;
ALTER TABLE seals ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'fichier';
ALTER TABLE seals ADD COLUMN IF NOT EXISTS revision_status TEXT DEFAULT 'valide';

-- 3. PROJECTS (Arbre de Merkle) — création complète
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  merkle_root TEXT,
  ots_proof TEXT,
  parent_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration : si l'ancienne colonne "name" existe, on la copie vers "title"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'name') THEN
    UPDATE projects SET title = name WHERE title IS NULL AND name IS NOT NULL;
  END IF;
END $$;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS merkle_root TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ots_proof TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE projects ALTER COLUMN title SET NOT NULL;

-- 4. PROJECT_FILES
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PACTS (contrats multi-signatures)
CREATE TABLE IF NOT EXISTS pacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id),
  group_id UUID,
  required_signatures INTEGER DEFAULT 2,
  hash BYTEA,
  ots_proof TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  is_hosted BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'Art',
  theme TEXT DEFAULT 'serieux',
  status TEXT DEFAULT 'en_attente',
  scelle_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pacts ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS is_hosted BOOLEAN DEFAULT FALSE;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'serieux';
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS hash BYTEA;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS ots_proof TEXT;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS scelle_at TIMESTAMPTZ;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS pact_hash BYTEA;

CREATE TABLE IF NOT EXISTS pact_signatures (
  pact_id UUID NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pact_id, user_id)
);
ALTER TABLE pact_signatures ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 6. MESSAGES (DM)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_audio BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. GROUPS
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_audio BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. FRIENDSHIPS
CREATE TABLE IF NOT EXISTS friendships (
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (requester_id, addressee_id)
);

-- 9. FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seal_id UUID NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, seal_id)
);

-- 10. LIKES & COMMENTS
CREATE TABLE IF NOT EXISTS likes (
  seal_id UUID NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT DEFAULT 'like',
  PRIMARY KEY (seal_id, user_id)
);
ALTER TABLE likes ADD COLUMN IF NOT EXISTS reaction_type TEXT DEFAULT 'like';

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id UUID NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. API_KEYS (pour les plugins)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. ACCESS_LOG (Journal des accès par sceau)
CREATE TABLE IF NOT EXISTS access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id UUID NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view','download')),
  context TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. ATTACHMENTS (Créations rattachées au feed)
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id UUID NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES attachments(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creation_likes (
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attachment_id, user_id)
);

-- 15. CHALLENGES (Défis)
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deadline TIMESTAMPTZ NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seal_id UUID NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, user_id, seal_id)
);

CREATE TABLE IF NOT EXISTS challenge_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES challenge_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, voter_id, entry_id)
);

-- 16. WEB_ARCHIVES (SCEAU Archive)
CREATE TABLE IF NOT EXISTS web_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  site_root TEXT,
  title TEXT,
  last_hash TEXT,
  last_content TEXT,
  last_status TEXT DEFAULT 'intact',
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  diff_data JSONB,
  pages_scanned INTEGER DEFAULT 1,
  scan_count INTEGER DEFAULT 0,
  ai_summary TEXT,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS site_root TEXT;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS pages_scanned INTEGER DEFAULT 1;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- 17. ORACLE_QUERIES (SCEAU Oracle)
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

-- 18. SESSIONS (pour la V2 sécurisée)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. WEB_ARCHIVE_HISTORY (pour la V2 - historique complet)
CREATE TABLE IF NOT EXISTS web_archive_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id UUID NOT NULL REFERENCES web_archives(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  content TEXT,
  status TEXT NOT NULL,
  diff_data JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX (performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_seals_author ON seals(author_id);
CREATE INDEX IF NOT EXISTS idx_seals_timestamp ON seals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_projects_author ON projects(author_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_pact_signatures_pact ON pact_signatures(pact_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_attachments_seal ON attachments(seal_id);
CREATE INDEX IF NOT EXISTS idx_access_log_seal ON access_log(seal_id);
CREATE INDEX IF NOT EXISTS idx_access_log_viewer ON access_log(viewer_id);
CREATE INDEX IF NOT EXISTS idx_web_archives_user ON web_archives(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_user ON oracle_queries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- ============================================================
-- MIGRATION : données existantes web_archives (site_root)
-- ============================================================
UPDATE web_archives 
SET site_root = CONCAT(
  split_part(url, '/', 1), '//', 
  split_part(url, '/', 3)
)
WHERE site_root IS NULL;

-- ============================================================
-- FIN
-- ============================================================
