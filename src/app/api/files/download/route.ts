import { NextResponse } from 'next/server';
import { r2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';

/**
 * Proxy de téléchargement universel.
 * Usage : GET /api/files/download?url=<url R2 publique>
 * Force le Content-Disposition: attachment.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');
  if (!rawUrl) return NextResponse.json({ error: 'url requis' }, { status: 400 });

  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || '').replace(/\/$/, '');
  const bucket = (process.env.S3_BUCKET || '').replace(/^\/+|\/+$/g, '');
  const prefix = `${endpoint}/${bucket}/`;

  if (!rawUrl.startsWith(prefix)) {
    return NextResponse.json({ error: 'URL non autorisée' }, { status: 403 });
  }

  const key = rawUrl.slice(prefix.length);
  const filename = decodeURIComponent(key.split('/').pop() || 'fichier');

  try {
    const obj = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!obj.Body) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

    let stream: ReadableStream;
    if (obj.Body instanceof Readable) {
      stream = Readable.toWeb(obj.Body) as unknown as ReadableStream;
    } else {
      stream = obj.Body as unknown as ReadableStream;
    }

    // Fallback ASCII pour le header
    const safe = filename
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

    return new NextResponse(stream, {
      headers: {
        'Content-Type': obj.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': obj.ContentLength ? String(obj.ContentLength) : '',
      },
    });
  } catch (e) {
    console.error('[files/download]', e);
    return NextResponse.json({ error: 'Erreur téléchargement' }, { status: 500 });
  }
}
