import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const title = data.get('title') as string;
    const description = data.get('description') as string;
    const pubkey = data.get('pubkey') as string;
    const groupId = data.get('group_id') as string;
    const requiredSignatures = parseInt(data.get('required_signatures') as string || '2');
    const hash = data.get('hash') as string;
    
    // Récupération de TOUS les fichiers
    const files = data.getAll('files') as File[];

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const creatorId = user.rows[0].id;

    let mediaUrls: string[] = [];
    
    // Upload de chaque fichier
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size === 0) continue;
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        await r2Client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: filename, Body: buffer, ContentType: file.type }));
        const fileUrl = `${process.env.AWS_ENDPOINT_URL_S3}/${process.env.S3_BUCKET}/${filename}`;
        mediaUrls.push(fileUrl);
      }
    }

    const pact = await pool.query(
      `INSERT INTO pacts (title, description, creator_id, group_id, required_signatures, hash, media_urls, is_hosted, category) 
       VALUES ($1, $2, $3, $4, $5, decode($6, 'base64'), $7, $8, 'Art') RETURNING id`,
      [title, description, creatorId, groupId || null, requiredSignatures, hash, JSON.stringify(mediaUrls), mediaUrls.length > 0]
    );
    
    await pool.query("INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2)", [pact.rows[0].id, creatorId]);
    
    return NextResponse.json({ id: pact.rows[0].id, title });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
