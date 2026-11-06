import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const hash = data.get('hash') as string;
    const title = data.get('title') as string;
    const description = data.get('description') as string;
    const isFlash = data.get('isFlash') === 'true';
    const isMystery = data.get('isMystery') === 'true';
    const unlockLikes = parseInt(data.get('unlockLikes') as string || '0');
    const pubkey = data.get('pubkey') as string;
    const file = data.get('file') as File;

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    let filePath = null;
    let fileSize = 0;
    
    // Si ce n'est pas un flash et qu'il y a un fichier, on l'héberge
    if (!isFlash && file) {
      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${file.name}`;
      await r2Client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: filename, Body: buffer, ContentType: file.type }));
      const baseUrl = process.env.AWS_ENDPOINT_URL_S3?.replace('https://', `https://${process.env.S3_BUCKET}.`);
      filePath = `${baseUrl}/${filename}`;
    }

    const result = await pool.query(
      `INSERT INTO seals (hash, timestamp, author_id, title, description, is_public, visibility, is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes) 
       VALUES (decode($1, 'base64'), NOW(), $2, $3, $4, true, 'public', $5, $6, $7, $8, $9, $10) RETURNING id`,
      [hash, authorId, title, description, !isFlash && filePath ? true : false, filePath, fileSize, isFlash, isMystery, unlockLikes]
    );

    return NextResponse.json({ seal_id: result.rows[0].id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
