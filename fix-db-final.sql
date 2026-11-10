-- =====================================================
-- TABLE PROJECTS (Arbre de Merkle)
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  merkle_root TEXT,
  ots_proof TEXT,
  parent_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajout des colonnes manquantes (si la table existait déjà)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS merkle_root TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ots_proof TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Migration : si l'ancienne colonne "name" existe, on la copie vers "title"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'name') THEN
    UPDATE projects SET title = name WHERE title IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- TABLE PROJECT_FILES (fichiers de chaque projet)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLE WEB_ARCHIVES (nouvelles colonnes)
-- =====================================================
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS site_root TEXT;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS pages_scanned INTEGER DEFAULT 1;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- =====================================================
-- INDEX (performance)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_author ON projects(author_id);
