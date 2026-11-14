import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileIndex: string }> },
) {
  const { id, fileIndex } = await params;
  const idx = parseInt(fileIndex, 10);

  const res = await pool.query('SELECT media_urls FROM pacts WHERE id = $1', [id]);
  if (res.rows.length === 0) return NextResponse.json({ error: 'Pacte introuvable' }, { status: 404 });

  const urls: string[] = Array.isArray(res.rows[0].media_urls)
    ? res.rows[0].media_urls
    : (() => { try { return JSON.parse(res.rows[0].media_urls); } catch { return []; } })();

  if (idx < 0 || idx >= urls.length) {
    return NextResponse.json({ error: 'Index invalide' }, { status: 400 });
  }

  const rawUrl = urls[idx];
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || '').replace(/\/$/, '');
  const bucket = (process.env.S3_BUCKET || '').replace(/^\/+|\/+$/g, '');
  const prefix = `${endpoint}/${bucket}/`;

  if (!rawUrl.startsWith(prefix)) {
    return NextResponse.json({ error: 'URL non autorisée' }, { status: 403 });
  }

  const key = rawUrl.slice(prefix.length);
  const filename = decodeURIComponent(key.split('/').pop() || `fichier-${idx}`);

  try {
    const obj = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!obj.Body) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

    const stream = obj.Body instanceof Readable
      ? Readable.toWeb(obj.Body) as unknown as ReadableStream
      : obj.Body as unknown as ReadableStream;

    const safe = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '_');

    return new NextResponse(stream, {
      headers: {
        'Content-Type': obj.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    console.error('[pact-files]', e);
    return NextResponse.json({ error: 'Erreur téléchargement' }, { status: 500 });
  }
}
