-- Ajout du rôle (Freelance, Musicien, Étudiant, etc.) et du GitHub
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'createur';
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
-- Ajout du type d'œuvre (Chapitre, Démo, Code, etc.) et du statut de révision
ALTER TABLE seals ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'fichier';
ALTER TABLE seals ADD COLUMN IF NOT EXISTS revision_status TEXT DEFAULT 'valide';
