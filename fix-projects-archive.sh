#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. LE SQL (à exécuter sur Neon - crucial)
# ==========================================================
say "1/5 → Génération du SQL (à exécuter sur Neon)"

cat > fix-db-final.sql << 'EOF'
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
EOF

echo -e "${YELLOW}  ⚠️  IMPORTANT : Copie le contenu de fix-db-final.sql et exécute-le sur Neon.${NC}"
echo -e "${YELLOW}  (Neon Console → SQL Editor → Coller → Run)${NC}"

# ==========================================================
# 2. API /api/projects : robustesse (fallback manifest)
# ==========================================================
say "2/5 → Renforcement de l'API /api/projects"

cat > "src/app/api/projects/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { submitToOts } from '@/lib/ots';
import { buildMerkleRoot } from '@/lib/merkle';
import { safeKeyPart } from '@/lib/safe-key';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const title = ((data.get('title') as string) || '').trim();
    const description = ((data.get('description') as string) || '').trim();
    const pubkey = data.get('pubkey') as string;
    const isHosted = data.get('isHosted') !== 'false';
    const parentId = data.get('parent_id') || null;
    const merkleRoot = data.get('merkle_root') as string;
    const manifestStr = data.get('manifest') as string;
    const files = (data.getAll('files') as File[]).filter((f) => f && f.size > 0);

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!merkleRoot || !manifestStr) return NextResponse.json({ error: 'Manifest Merkle manquant' }, { status: 400 });
    if (files.length > 100) return NextResponse.json({ error: 'Maximum 100 fichiers par projet' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    const manifest = JSON.parse(manifestStr) as { name: string; hash: string; size: number }[];

    // Vérification crypto Merkle
    const calculatedRoot = buildMerkleRoot(manifest.map(m => m.hash));
    if (calculatedRoot !== merkleRoot) {
      return NextResponse.json({ error: 'Incohérence cryptographique (Merkle)' }, { status: 400 });
    }

    // Ancrage OTS
    let otsProof: string | null = null;
    try {
      const ots = await submitToOts(new Uint8Array(Buffer.from(merkleRoot, 'base64')));
      if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
    } catch (e) { console.warn('[OTS]', e); }

    // Upload (match par index, plus robuste que par nom)
    const uploadedRecords: { name: string; hash: string; size: number; path: string | null }[] = [];
    if (isHosted) {
      const { endpoint, bucket } = requireS3();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Fallback : d'abord par nom, sinon par index
        let rec = manifest.find(m => m.name === file.name);
        if (!rec) rec = manifest[i];
        if (!rec) {
          console.warn('[projects] fichier orphelin :', file.name);
          continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const safeName = safeKeyPart(file.name, 60);
        const key = `projects/${authorId.slice(0, 8)}/${Date.now()}-${safeName}`;
        
        await r2Client.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: buffer,
          ContentType: file.type || 'application/octet-stream',
        }));
        uploadedRecords.push({ ...rec, path: `${endpoint}/${bucket}/${key}` });
      }
    } else {
      manifest.forEach((rec, i) => uploadedRecords.push({ ...rec, path: null }));
    }

    // Transaction DB
    const client = await pool.connect();
    let projectId: string;
    try {
      await client.query('BEGIN');
      const projectRes = await client.query(
        `INSERT INTO projects (author_id, title, description, merkle_root, ots_proof, parent_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [authorId, title, description, merkleRoot, otsProof, parentId]
      );
      projectId = projectRes.rows[0].id;

      for (const rec of uploadedRecords) {
        await client.query(
          `INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path)
           VALUES ($1, $2, $3, $4, $5)`,
          [projectId, rec.name, rec.hash, rec.size, rec.path]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ 
      success: true, 
      project_id: projectId, 
      merkle_root: merkleRoot, 
      files_count: uploadedRecords.length 
    });
  } catch (e: any) {
    console.error('[projects POST]', e);
    return NextResponse.json({ error: e?.message || 'Erreur lors de la création du projet' }, { status: 500 });
  }
}
EOF
echo "  ✓ API /api/projects renforcée"

# ==========================================================
# 3. API /api/archive GET : fallback si colonnes manquantes
# ==========================================================
say "3/5 → API /api/archive GET (fallback si colonnes manquantes)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/archive/route.ts'
s = open(p, encoding='utf-8').read()

old_get = """    const result = await pool.query(`
      SELECT id, url, site_root, title, last_status, last_checked_at, created_at, diff_data, pages_scanned, scan_count, ai_summary
      FROM web_archives WHERE user_id = $1 ORDER BY created_at DESC
    `, [user.rows[0].id]);"""

new_get = """    let result;
    try {
      result = await pool.query(`
        SELECT id, url, site_root, title, last_status, last_checked_at, created_at, diff_data, pages_scanned, scan_count, ai_summary
        FROM web_archives WHERE user_id = $1 ORDER BY created_at DESC
      `, [user.rows[0].id]);
    } catch (colErr) {
      console.warn('[archive GET] colonnes manquantes, fallback:', colErr);
      result = await pool.query(`
        SELECT id, url, title, last_status, last_checked_at, created_at, diff_data
        FROM web_archives WHERE user_id = $1 ORDER BY created_at DESC
      `, [user.rows[0].id]);
    }"""

if old_get in s:
    s = s.replace(old_get, new_get)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ GET Archive robuste (fallback)')
else:
    print('  ⚠️ Pattern GET introuvable')
PYEOF

# ==========================================================
# 4. Page /archive : toute la carte cliquable
# ==========================================================
say "4/5 → Carte Archive entièrement cliquable"

python3 - << 'PYEOF'
import sys
p = 'src/app/archive/page.tsx'
s = open(p, encoding='utf-8').read()

# Remplacer toute la carte par un lien (clic n'importe où)
old_item = """            <div key={a.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 ${i !== archives.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${a.last_status === 'modified' ? 'bg-[#FDF4F0]' : ''}`}>
              
              <div className="flex items-center gap-3 mb-3 md:mb-0">
                <div className={`w-2 h-2 rounded-full ${a.last_status === 'modified' ? 'bg-red-500' : a.last_status === 'error' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                <div>
                  <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{a.title || a.url}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate max-w-[300px]">{a.url}</p>
                  {a.last_status === 'modified' && <p className="text-[0.65rem] text-red-600 font-bold uppercase mt-1">Modification détectée</p>}
                  {a.last_status === 'error' && <p className="text-[0.65rem] text-orange-600 font-bold uppercase mt-1">Inaccessible / Erreur</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">
                  Vérifié le {new Date(a.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
                <Link
                  href={`/archive/${a.id}`}
                  className="bg-[#1A1513] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition"
                >
                  Voir le détail →
                </Link>
                <button onClick={() => deleteUrl(a.id)} className="text-red-400 hover:text-red-600 px-2 text-lg">✕</button>
              </div>
            </div>"""

new_item = """            <div key={a.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-[var(--bg-main)] transition cursor-pointer ${i !== archives.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${a.last_status === 'modified' ? 'bg-[#FDF4F0]' : ''}`}>
              <Link href={`/archive/${a.id}`} className="flex items-center gap-3 mb-3 md:mb-0 flex-1">
                <div className={`w-2 h-2 rounded-full shrink-0 ${a.last_status === 'modified' ? 'bg-red-500' : a.last_status === 'error' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{a.title || a.url}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate max-w-full">{a.url}</p>
                  {a.last_status === 'modified' && <p className="text-[0.65rem] text-red-600 font-bold uppercase mt-1">Modification détectée</p>}
                  {a.last_status === 'error' && <p className="text-[0.65rem] text-orange-600 font-bold uppercase mt-1">Inaccessible</p>}
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">
                  {new Date(a.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
                <Link
                  href={`/archive/${a.id}`}
                  className="bg-[#1A1513] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition"
                >
                  Voir le détail →
                </Link>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteUrl(a.id); }} 
                  className="text-red-400 hover:text-red-600 px-2 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>"""

if old_item in s:
    s = s.replace(old_item, new_item)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Carte Archive entièrement cliquable')
else:
    print('  ⚠️ Pattern carte introuvable, vérification manuelle nécessaire')
PYEOF

# ==========================================================
# 5. Build
# ==========================================================
say "5/5 → Nettoyage et build"

rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Tout est prêt. N'oublie pas d'exécuter fix-db-final.sql sur Neon !${NC}"
