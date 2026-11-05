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
    const file = data.get('file') as File;

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    let filePath = null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `pact-${Date.now()}-${file.name}`;
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: filename,
        Body: buffer,
        ContentType: file.type,
      }));
      filePath = `${process.env.AWS_ENDPOINT_URL_S3}/${process.env.S3_BUCKET}/${filename}`;
    }

    const pact = await pool.query(
      "INSERT INTO pacts (title, description, creator_id, file_path) VALUES ($1, $2, $3, $4) RETURNING id",
      [title, description, user.rows[0].id, filePath]
    );
    
    // Le créateur signe automatiquement
    await pool.query("INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2)", [pact.rows[0].id, user.rows[0].id]);
    
    return NextResponse.json({ id: pact.rows[0].id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
