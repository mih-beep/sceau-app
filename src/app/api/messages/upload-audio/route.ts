import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { sha256 } from '@noble/hashes/sha256';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const pubkey = data.get('pubkey') as string;
    const audio = data.get('audio') as File;

    if (!pubkey || !audio) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    if (audio.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio trop lourd (max 2 Mo)' }, { status: 413 });
    }

    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) {
      return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const hash = sha256(new Uint8Array(buffer));
    const hashHex = Buffer.from(hash).toString('hex').slice(0, 16);
    const filename = `audio-${hashHex}-${Date.now()}.webm`;

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: audio.type || 'audio/webm',
    }));

    const url = `${process.env.AWS_ENDPOINT_URL_S3}/${process.env.S3_BUCKET}/${filename}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error('[upload-audio]', e);
    return NextResponse.json({ error: 'Erreur upload' }, { status: 500 });
  }
}
