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
    if (files.length > 100) return NextResponse.json({ error: 'Maximum 100 fichiers par projet' }, { status: 400 });
    
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf', 'txt', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'html', 'css', 'js', 'ts', 'json'];
    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      const ext = file.name.toLowerCase().split('.').pop() || '';
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json({ error: `Format interdit : ${file.name}` }, { status: 400 });
      }
    }
    if (totalSize > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Le projet dépasse 100 Mo' }, { status: 413 });
    }

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
