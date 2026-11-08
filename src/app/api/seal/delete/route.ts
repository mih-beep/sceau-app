import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { extractS3Key } from '@/lib/safe-key';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sealId = searchParams.get('id');
    const pubkey = searchParams.get('pubkey');
    if (!sealId || !pubkey) return NextResponse.json({ error: 'ID ou clé manquant' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const seal = await pool.query("SELECT author_id, file_path FROM seals WHERE id = $1", [sealId]);
    if (seal.rows.length === 0) return NextResponse.json({ error: 'Sceau introuvable' }, { status: 404 });
    if (seal.rows[0].author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const filePath: string | null = seal.rows[0].file_path;
    if (filePath) {
      const key = extractS3Key(filePath);
      if (key) {
        try {
          await r2Client.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
          }));
        } catch (e) { console.warn('[delete] S3 delete échoué', e); }
      }
    }

    await pool.query("DELETE FROM seals WHERE id = $1", [sealId]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e, 'Erreur lors de la suppression');
  }
}
