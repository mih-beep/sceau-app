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
    const isEphemeral = data.get('isEphemeral') === 'true';
    const unlockLikes = parseInt(data.get('unlockLikes') as string || '0');
    const pubkey = data.get('pubkey') as string;
    const file = data.get('file') as File;

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    let filePath = null;
    let fileSize = 0;
    let otsProof = null;

    // --- L'ANCRAGE BITCOIN (OpenTimestamps) ---
    try {
      // On envoie le hash à l'agrégateur public OpenTimestamps
      const otsRes = await fetch('https://a.pool.opentimestamps.org/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(hash, 'base64') // Le hash doit être envoyé en binaire
      });
      
      if (otsRes.ok) {
        const arrayBuffer = await otsRes.arrayBuffer();
        // On convertit la preuve binaire en texte pour la stocker en base
        otsProof = Buffer.from(arrayBuffer).toString('base64');
      }
    } catch (otsError) {
      console.error("Erreur OpenTimestamps (on continue quand même) :", otsError);
    }
    // ------------------------------------------

    if (!isFlash && file) {
      // VÉRIFICATION DU QUOTA (50 Mo)
      const quotaCheck = await pool.query("SELECT COALESCE(SUM(file_size), 0) as used FROM seals WHERE author_id = $1 AND is_hosted = true", [authorId]);
      const currentUsage = parseInt(quotaCheck.rows[0].used);
      const maxQuota = 50 * 1024 * 1024;
      
      if (currentUsage + file.size > maxQuota) {
        return NextResponse.json({ error: 'Quota de 50 Mo dépassé.' }, { status: 403 });
      }

      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${file.name}`;
      
      await r2Client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: filename, Body: buffer, ContentType: file.type }));
      const baseUrl = process.env.AWS_ENDPOINT_URL_S3;
      filePath = `${baseUrl}/${process.env.S3_BUCKET}/${filename}`;
    }

    // On enregistre tout, y compris la preuve OpenTimestamps
    const result = await pool.query(
      `INSERT INTO seals (hash, timestamp, author_id, title, description, is_public, visibility, is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral, ots_proof) 
       VALUES (decode($1, 'base64'), NOW(), $2, $3, $4, true, 'public', $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [hash, authorId, title, description, !isFlash && filePath ? true : false, filePath, fileSize, isFlash, isMystery, unlockLikes, isEphemeral, otsProof]
    );

    return NextResponse.json({ 
      seal_id: result.rows[0].id, 
      ots_secured: otsProof !== null // On dit au frontend si l'ancrage a réussi
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
