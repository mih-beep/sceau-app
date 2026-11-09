import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { safeKeyPart } from '@/lib/safe-key';
import { apiError } from '@/lib/api-error';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const uploadedKeys: string[] = [];
  try {
    const data = await req.formData();
    const title = ((data.get('title') as string) || '').trim();
    const description = ((data.get('description') as string) || '').trim();
    const pubkey = data.get('pubkey') as string;
    const groupId = (data.get('group_id') as string) || null;
    const requiredSignatures = parseInt((data.get('required_signatures') as string) || '2', 10);
    const hash = data.get('hash') as string;
    const files = (data.getAll('files') as File[]).filter((f) => f && f.size > 0);
    
    // ✅ On déclare le thème proprement ici
    const theme = (data.get('theme') as string) || 'serieux';

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!hash) return NextResponse.json({ error: 'Hash requis' }, { status: 400 });
    if (requiredSignatures < 2 || requiredSignatures > 50) {
      return NextResponse.json({ error: 'required_signatures doit être entre 2 et 50' }, { status: 400 });
    }
    if (files.length > 10) return NextResponse.json({ error: 'Trop de fichiers (max 10)' }, { status: 400 });
    if (files.reduce((s, f) => s + f.size, 0) > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichiers trop lourds (max 4 Mo au total)' }, { status: 413 });
    }

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const creatorId = user.rows[0].id as string;
    const { endpoint, bucket } = requireS3();

    const mediaUrls: string[] = [];
    for (const file of files) {
      const safeName = safeKeyPart(file.name, 60);
      const key = `pact/${creatorId.slice(0, 8)}/${Date.now()}-${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        ContentLength: buffer.length,
      }));
      uploadedKeys.push(key);
      mediaUrls.push(`${endpoint}/${bucket}/${key}`);
    }

    const client = await pool.connect();
    let pactId: string;
    try {
      await client.query('BEGIN');
      const pact = await client.query(
        `INSERT INTO pacts (title, description, creator_id, group_id, required_signatures, hash, media_urls, is_hosted, category, theme)
         VALUES ($1, $2, $3, $4, $5, decode($6, 'base64'), $7, $8, 'Art', $9) RETURNING id`,
        [title, description, creatorId, groupId, requiredSignatures, hash, JSON.stringify(mediaUrls), mediaUrls.length > 0, theme]
      );
      pactId = pact.rows[0].id;
      await client.query(
        "INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [pactId, creatorId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      for (const key of uploadedKeys) {
        r2Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })).catch(() => {});
      }
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ id: pactId, title });
  } catch (e) {
    return apiError(e, 'Erreur lors de la création du pacte');
  }
}
