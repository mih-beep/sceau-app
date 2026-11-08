import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { extractS3Key } from '@/lib/safe-key';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 30;

function encodeContentDisposition(filename: string): string {
  const asciiFallback = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function toWebStream(body: any): Promise<ReadableStream> {
  if (body instanceof Readable) return Readable.toWeb(body) as unknown as ReadableStream;
  if (body && typeof body.getReader === 'function') return body as ReadableStream;
  if (body && typeof body[Symbol.asyncIterator] === 'function') {
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of body) controller.enqueue(chunk);
          controller.close();
        } catch (e) { controller.error(e); }
      },
    });
  }
  throw new Error('Body S3 non supporté');
}

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

    const key = extractS3Key(res.rows[0].file_path);
    if (!key) return NextResponse.json({ error: 'Clé S3 invalide' }, { status: 500 });

    const obj = await r2Client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }));
    if (!obj.Body) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

    if (viewerPubkey) {
      pool.query(
        "INSERT INTO access_log (seal_id, viewer_id, action, context) SELECT $1, id, 'download', 'public' FROM users WHERE encode(pubkey, 'base64') = $2",
        [id, viewerPubkey]
      ).catch((e) => console.warn('[download] log échoué', e));
    }

    const webStream = await toWebStream(obj.Body);
    const filename = key.split('/').pop() || 'file';

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': obj.ContentType || 'application/octet-stream',
        'Content-Disposition': encodeContentDisposition(filename),
        'Content-Length': obj.ContentLength ? String(obj.ContentLength) : '',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (e) {
    return apiError(e, 'Erreur lors du téléchargement');
  }
}
