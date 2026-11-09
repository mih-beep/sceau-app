#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Correction de l'API Projects (Hash reçu, pas calculé)
# ==========================================================
say "1/3 → Correction API /api/projects (Hash client)"

cat > "src/app/api/projects/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { submitToOts } from '@/lib/ots';
import { buildMerkleRoot } from '@/lib/merkle';
import { safeKeyPart } from '@/lib/safe-key';
import { apiError } from '@/lib/api-error';
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
    const merkleRoot = data.get('merkle_root') as string;
    const manifestStr = data.get('manifest') as string; // JSON array of {name, hash, size}
    const files = (data.getAll('files') as File[]).filter((f) => f && f.size > 0);

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!merkleRoot || !manifestStr) return NextResponse.json({ error: 'Manifest Merkle manquant' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    const manifest = JSON.parse(manifestStr) as { name: string; hash: string; size: number }[];

    // 1. VÉRIFICATION : On s'assure que le Root fourni correspond aux hashs
    const calculatedRoot = buildMerkleRoot(manifest.map(m => m.hash));
    if (calculatedRoot !== merkleRoot) {
      return NextResponse.json({ error: 'Incohérence cryptographique (Merkle)' }, { status: 400 });
    }

    // 2. Ancrage OTS
    let otsProof: string | null = null;
    try {
      const ots = await submitToOts(new Uint8Array(Buffer.from(merkleRoot, 'base64')));
      if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
    } catch (e) { console.warn('[OTS]', e); }

    // 3. Upload
    const uploadedRecords: { name: string; hash: string; size: number; path: string | null }[] = [];
    if (isHosted) {
      const { endpoint, bucket } = requireS3();
      for (const file of files) {
        // On retrouve le hash correspondant dans le manifest (basé sur le nom)
        const rec = manifest.find(m => m.name === file.name);
        if (!rec) continue;

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
      manifest.forEach(rec => uploadedRecords.push({ ...rec, path: null }));
    }

    // 4. Transaction DB
    const client = await pool.connect();
    let projectId: string;
    try {
      await client.query('BEGIN');
      const projectRes = await client.query(
        `INSERT INTO projects (author_id, title, description, merkle_root, ots_proof) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [authorId, title, description, merkleRoot, otsProof]
      );
      projectId = projectRes.rows[0].id;

      for (const rec of uploadedRecords) {
        await client.query(
          `INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path) VALUES ($1, $2, $3, $4, $5)`,
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

    return NextResponse.json({ success: true, project_id: projectId, merkle_root: merkleRoot, files_count: manifest.length });
  } catch (e) {
    return apiError(e, 'Erreur lors de la création du projet');
  }
}
EOF

# ==========================================================
# 2. Correction de l'Atelier (Calcul côté client)
# ==========================================================
say "2/3 → Correction de l'Atelier (Merkle côté client)"

python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier seal/page.tsx introuvable')

# Import de la fonction Merkle
if "import { buildMerkleRoot } from '@/lib/merkle';" not in s:
    s = s.replace(
        "import { sha256 } from '@noble/hashes/sha256';",
        "import { sha256 } from '@noble/hashes/sha256';\nimport { buildMerkleRoot } from '@/lib/merkle';"
    )

# Modification du handleSeal
old_hash = """      let hashContent: Uint8Array;

      if (mode === 'project') {
        // Pour un projet, le hash principal est calculé côté serveur (Merkle Root)
        hashContent = sha256(new TextEncoder().encode(title)); // Hash factice temporaire
      } else if (isPactMode) {"""
new_hash = """      let hashContent: Uint8Array;
      let projectManifest: any[] = [];
      let merkleRoot = '';

      if (mode === 'project') {
        // On calcule les hashs de tous les fichiers localement
        for (const f of projectFiles) {
          const buf = await f.arrayBuffer();
          const h = sha256(new Uint8Array(buf));
          const hB64 = btoa(String.fromCharCode(...h));
          projectManifest.push({ name: f.name, hash: hB64, size: f.size });
        }
        merkleRoot = buildMerkleRoot(projectManifest.map(m => m.hash));
        // Le hash principal du sceau (pour l'affichage) sera le Merkle Root
        hashContent = new Uint8Array(Buffer.from(merkleRoot, 'base64'));
      } else if (isPactMode) {"""
if old_hash in s: s = s.replace(old_hash, new_hash)

# Ajout du manifest au FormData
old_form = """    if (mode === 'project') {
      endpoint = '/api/projects';
      formData.append('isHosted', isHosted.toString());
      projectFiles.forEach(f => formData.append('files', f));
    } else if (isPactMode) {"""
new_form = """    if (mode === 'project') {
      endpoint = '/api/projects';
      formData.append('isHosted', isHosted.toString());
      formData.append('merkle_root', merkleRoot); // On ajoute le root calculé client
      formData.append('manifest', JSON.stringify(projectManifest));
      projectFiles.forEach(f => formData.append('files', f));
    } else if (isPactMode) {"""
if old_form in s: s = s.replace(old_form, new_form)

# On doit aussi s'assurer que merkleRoot et projectManifest sont accessibles dans sendToServer
# On les passe en paramètres
old_send = """  async function sendToServer(hashB64: string) {"""
new_send = """  async function sendToServer(hashB64: string, merkleRoot?: string, projectManifest?: any[]) {"""
if old_send in s: s = s.replace(old_send, new_send)

# Modification de l'appel sendToServer
old_call = """      await sendToServer(btoa(hashStr));"""
new_call = """      if (mode === 'project') {
        await sendToServer(merkleRoot, merkleRoot, projectManifest);
      } else {
        await sendToServer(btoa(hashStr));
      }"""
if old_call in s: s = s.replace(old_call, new_call)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Atelier corrigé (calcul Merkle côté client)')
PYEOF

# ==========================================================
# 3. Correction du bouton "Générer" (Mobile)
# ==========================================================
say "3/3 → Correction du bouton Générer (Mobile)"

python3 - << 'PYEOF'
import sys
p = 'src/app/settings/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier settings/page.tsx introuvable')

old_btn = """          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Nom (ex: Mon site WordPress)" 
              className="flex-1 border-2 border-[#C9D8E8] p-2 rounded-xl bg-white focus:border-[#4A90C2] outline-none text-sm" 
              value={newKeyName} 
              onChange={e => setNewKeyName(e.target.value)} 
            />
            <button 
              onClick={generateApiKey} 
              disabled={isGeneratingKey}
              className="bg-[#4A90C2] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md disabled:opacity-50"
            >
              {isGeneratingKey ? '...' : 'Générer'}
            </button>
          </div>"""

new_btn = """          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Nom (ex: Mon site WordPress)" 
              className="flex-1 min-w-0 border-2 border-[#C9D8E8] p-2 rounded-xl bg-white focus:border-[#4A90C2] outline-none text-sm" 
              value={newKeyName} 
              onChange={e => setNewKeyName(e.target.value)} 
            />
            <button 
              onClick={generateApiKey} 
              disabled={isGeneratingKey}
              className="bg-[#4A90C2] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 shrink-0"
            >
              {isGeneratingKey ? '...' : 'Générer'}
            </button>
          </div>"""

if old_btn in s: s = s.replace(old_btn, new_btn)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Bouton Générer corrigé pour mobile')
PYEOF

echo ""
echo -e "${GREEN}✅ Contradictions résolues.${NC}"
