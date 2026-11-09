#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Le Moteur Merkle (src/lib/merkle.ts)
# ==========================================================
say "1/2 → Création du moteur Merkle (src/lib/merkle.ts)"

cat > src/lib/merkle.ts << 'EOF'
import { sha256 } from '@noble/hashes/sha256';

/**
 * Prend une liste de hashs (en Base64) et calcule le Hash Racine (Merkle Root).
 * Les hashs sont triés pour garantir que l'ordre des fichiers n'affecte pas le résultat.
 */
export function buildMerkleRoot(hashesB64: string[]): string {
  if (hashesB64.length === 0) return '';
  if (hashesB64.length === 1) return hashesB64[0];

  // On s'assure que tous les hashs sont décodés en Buffer pour la concaténation
  let currentLevel = hashesB64.map(h => Buffer.from(h, 'base64'));

  while (currentLevel.length > 1) {
    const nextLevel: Buffer[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Hachage de la concaténation de deux hashs
        const combined = Buffer.concat([currentLevel[i], currentLevel[i + 1]]);
        const hash = sha256(new Uint8Array(combined));
        nextLevel.push(Buffer.from(hash));
      } else {
        // S'il reste un élément impair, on le passe au niveau supérieur tel quel
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0].toString('base64');
}
EOF

# ==========================================================
# 2. L'API Projets (src/app/api/projects/route.ts)
# ==========================================================
say "2/2 → Création de l'API Projets"

mkdir -p "src/app/api/projects"
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
import { sha256 } from '@noble/hashes/sha256';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const title = ((data.get('title') as string) || '').trim();
    const description = ((data.get('description') as string) || '').trim();
    const pubkey = data.get('pubkey') as string;
    const isHosted = data.get('isHosted') !== 'false';
    const files = (data.getAll('files') as File[]).filter((f) => f && f.size > 0);

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (files.length === 0) return NextResponse.json({ error: 'Aucun fichier sélectionné' }, { status: 400 });
    if (files.length > 100) return NextResponse.json({ error: 'Maximum 100 fichiers par projet' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    // 1. Calculer les hashs de tous les fichiers
    const fileRecords: { name: string; hashB64: string; size: number; file: File }[] = [];
    let totalSize = 0;

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf', 'txt', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'html', 'css', 'js', 'ts', 'json'];

    for (const file of files) {
      totalSize += file.size;
      const ext = file.name.toLowerCase().split('.').pop() || '';
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json({ error: `Format interdit : ${file.name} (.${ext})` }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = sha256(new Uint8Array(buffer));
      const hashB64 = Buffer.from(hash).toString('base64');

      fileRecords.push({ name: file.name, hashB64, size: file.size, file });
    }

    if (totalSize > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Le projet dépasse la taille maximale (100 Mo)' }, { status: 413 });
    }

    // 2. Construire l'Arbre de Merkle
    const hashes = fileRecords.map(r => r.hashB64);
    const merkleRootB64 = buildMerkleRoot(hashes);

    // 3. Ancrer la racine Merkle sur Bitcoin (OpenTimestamps)
    let otsProof: string | null = null;
    try {
      const rootHashBytes = new Uint8Array(Buffer.from(merkleRootB64, 'base64'));
      const ots = await submitToOts(rootHashBytes);
      if (ots.ok && ots.proof) {
        otsProof = ots.proof.toString('base64');
      }
    } catch (e) {
      console.warn('[OTS] exception :', e);
    }

    // 4. Uploader les fichiers sur S3 (si demandé)
    const uploadedRecords: { name: string; hashB64: string; size: number; path: string | null }[] = [];
    
    if (isHosted) {
      const { endpoint, bucket } = requireS3();
      for (const rec of fileRecords) {
        const buffer = Buffer.from(await rec.file.arrayBuffer());
        const safeName = safeKeyPart(rec.name, 60);
        const key = `projects/${authorId.slice(0, 8)}/${Date.now()}-${safeName}`;
        
        await r2Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: rec.file.type || 'application/octet-stream',
          ContentLength: buffer.length,
        }));
        
        uploadedRecords.push({ name: rec.name, hashB64: rec.hashB64, size: rec.size, path: `${endpoint}/${bucket}/${key}` });
      }
    } else {
      fileRecords.forEach(rec => uploadedRecords.push({ name: rec.name, hashB64: rec.hashB64, size: rec.size, path: null }));
    }

    // 5. Enregistrer en base de données (Transaction)
    const client = await pool.connect();
    let projectId: string;

    try {
      await client.query('BEGIN');

      const projectRes = await client.query(
        `INSERT INTO projects (author_id, title, description, merkle_root, ots_proof)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [authorId, title, description, merkleRootB64, otsProof]
      );
      projectId = projectRes.rows[0].id;

      for (const rec of uploadedRecords) {
        await client.query(
          `INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path)
           VALUES ($1, $2, $3, $4, $5)`,
          [projectId, rec.name, rec.hashB64, rec.size, rec.path]
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
      merkle_root: merkleRootB64,
      files_count: uploadedRecords.length,
      ots_secured: otsProof !== null
    });

  } catch (e) {
    return apiError(e, 'Erreur lors de la création du projet');
  }
}
EOF

echo ""
echo -e "${GREEN}✅ Moteur Merkle et API Projets prêts.${NC}"
