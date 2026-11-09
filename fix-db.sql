-- Ajout de la colonne manquante qui faisait planter la signature
ALTER TABLE pact_signatures ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
-- Ajout des colonnes pour les pactes si manquantes
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS is_hosted BOOLEAN DEFAULT FALSE;
ALTER TABLE pacts ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'serieux';
