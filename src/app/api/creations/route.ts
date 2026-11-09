import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { safeKeyPart } from '@/lib/safe-key';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';

// GET : Récupérer les créations d'un sceau (ou d'une création si parent_id est fourni)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sealId = searchParams.get('seal_id');
  const parentId = searchParams.get('parent_id');

  if (!sealId) return NextResponse.json({ error: 'seal_id manquant' }, { status: 400 });

  try {
    let sql = `
      SELECT a.id, a.type, a.content, a.media_url, a.created_at, a.parent_id, u.handle as author, (SELECT COUNT(*) FROM creation_likes WHERE attachment_id = a.id) as likes_count
      FROM attachments a 
      JOIN users u ON a.user_id = u.id
      WHERE a.seal_id = $1
    `;
    const params: any[] = [sealId];

    if (parentId) {
      sql += " AND a.parent_id = $2";
      params.push(parentId);
    } else {
      sql += " AND a.parent_id IS NULL"; // On ne récupère que le niveau principal
    }

    sql += " ORDER BY a.created_at DESC LIMIT 50";
    
    const result = await pool.query(sql, params);
    return NextResponse.json({ creations: result.rows });
  } catch (e) {
    console.error('[creations GET]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// POST : Créer une nouvelle création (vidéo, image, ou texte)
export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const seal_id = data.get('seal_id') as string;
    const pubkey = data.get('pubkey') as string;
    const content = data.get('content') as string || '';
    const type = data.get('type') as string || 'text';
    const parent_id = data.get('parent_id') as string || null;
    const file = data.get('file') as File | null;

    if (!seal_id || !pubkey) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    let media_url: string | null = null;

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { endpoint, bucket } = requireS3();
      const key = `creations/${safeKeyPart(seal_id.slice(0, 8))}/${Date.now()}-${safeKeyPart(file.name)}`;
      
      await r2Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      }));
      media_url = `${endpoint}/${bucket}/${key}`;
    }

    const res = await pool.query(
      `INSERT INTO attachments (seal_id, user_id, content, type, media_url, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [seal_id, user.rows[0].id, content, type, media_url, parent_id]
    );

    return NextResponse.json({ success: true, id: res.rows[0].id });
  } catch (e) {
    console.error('[creations POST]', e);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}
