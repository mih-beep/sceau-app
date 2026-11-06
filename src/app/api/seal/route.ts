import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { headers } from 'next/headers';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const hash = data.get('hash') as string;
    const title = data.get('title') as string;
    const description = data.get('description') as string;
    const category = data.get('category') as string;
    const workType = data.get('workType') as string || 'fichier';
    const visibility = data.get('visibility') as string || 'public'; // NOUVEAU
    const isHosted = data.get('isHosted') === 'true';
    const pubkey = data.get('pubkey') as string;
    const file = data.get('file') as File;

    const headersList = await headers();
    const country = headersList.get('x-vercel-ip-country') || 'Inconnu';
    const location = country;

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    let filePath = null;
    let fileSize = 0;
    
    if (isHosted && file) {
      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${file.name}`;
      await r2Client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: filename, Body: buffer, ContentType: file.type }));
      const baseUrl = process.env.AWS_ENDPOINT_URL_S3?.replace('https://', `https://${process.env.S3_BUCKET}.`);
      filePath = `${baseUrl}/${filename}`;
    }

    let timestamp = new Date().toISOString();

    // is_public est synchronisé pour compatibilité avec l'ancien code
    const isPublicBoolean = visibility === 'public';

    const result = await pool.query(
      `INSERT INTO seals (hash, timestamp, author_id, title, description, category, is_public, visibility, is_hosted, file_path, file_size, location, work_type) 
       VALUES (decode($1, 'base64'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [hash, timestamp, authorId, title, description, category, isPublicBoolean, visibility, isHosted, filePath, fileSize, location, workType]
    );

    return NextResponse.json({ seal_id: result.rows[0].id, timestamp });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
