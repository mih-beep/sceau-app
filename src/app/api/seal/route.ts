import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
const OpenTimestamps = require('javascript-opentimestamps');

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const hash = data.get('hash') as string;
    const title = data.get('title') as string;
    const description = data.get('description') as string;
    const category = data.get('category') as string;
    const isHosted = data.get('isHosted') === 'true';
    const isPublic = data.get('isPublic') === 'true';
    const pubkey = data.get('pubkey') as string;
    const file = data.get('file') as File;

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    // Vérification du quota (500 Mo)
    if (isHosted && file) {
      const quotaCheck = await pool.query("SELECT COALESCE(SUM(file_size), 0) as used FROM seals WHERE author_id = $1 AND is_hosted = true", [authorId]);
      const currentUsage = parseInt(quotaCheck.rows[0].used);
      if (currentUsage + file.size > 500 * 1024 * 1024) {
        return NextResponse.json({ error: 'Quota de 500 Mo dépassé.' }, { status: 403 });
      }
    }

    let filePath = null;
    let fileSize = 0;
    
    // --- UPLOAD VERS CLOUDFLARE R2 ---
    if (isHosted && file) {
      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${file.name}`;
      
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: file.type,
      }));

      // Si tu as configuré un accès public sur R2, l'URL ressemblera à ça :
      filePath = `${process.env.R2_PUBLIC_URL}/${filename}`;
    }

    // --- ANCRAGE OPENTIMESTAMPS ---
    let otsProofPath = null;
    let timestamp = new Date().toISOString();
    try {
      const hashBuffer = Buffer.from(hash, 'base64');
      const detached = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), hashBuffer);
      await OpenTimestamps.stamp(detached);
      // On ne sauvegarde plus le .ots en local (éphémère), on le met dans la base de données en base64 pour plus tard
      otsProofPath = Buffer.from(detached.serialize()).toString('base64');
    } catch (otsError) { console.error("Erreur OTS:", otsError); }

    await pool.query(
      `INSERT INTO seals (hash, timestamp, author_id, title, description, category, is_public, is_hosted, file_path, file_size) 
       VALUES (decode($1, 'base64'), $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [hash, timestamp, authorId, title, description, category, isPublic, isHosted, filePath, fileSize]
    );

    return NextResponse.json({ seal_id: Math.random().toString(36).substring(2, 10), timestamp });
  } catch (error) { 
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 }); 
  }
}
