import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const viewerPubkey = searchParams.get('viewer');

  try {
    const res = await pool.query(
      "SELECT file_path FROM seals WHERE id = $1 AND visibility = 'public'",
      [id]
    );
    if (res.rows.length === 0 || !res.rows[0].file_path) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    const filename = res.rows[0].file_path.split('/').pop() as string;

    const obj = await r2Client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: filename,
    }));

    if (!obj.Body) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
    }

    // Log après vérification, avant envoi
    if (viewerPubkey) {
      const v = await pool.query(
        "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
        [viewerPubkey]
      );
      if (v.rows.length > 0) {
        await pool.query(
          "INSERT INTO access_log (seal_id, viewer_id, action, context) VALUES ($1, $2, 'download', 'public')",
          [id, v.rows[0].id]
        );
      }
    }

    // Conversion en Buffer (compatible Node 18+ et Vercel Edge)
    const streamToBuffer = async (stream: any): Promise<Buffer> => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    };

    const buffer = await streamToBuffer(obj.Body);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': obj.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    console.error('[download]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
