import { NextResponse } from 'next/server';
import { r2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');
  if (!rawUrl) return NextResponse.json({ error: 'url requis' }, { status: 400 });

  // On récupère la clé de manière plus souple
  let key = rawUrl.split('/').slice(-2).join('/'); // Garde les 2 derniers segments
  if (rawUrl.includes('/seal/')) {
      key = rawUrl.substring(rawUrl.indexOf('/seal/') + 1);
  }

  const filename = decodeURIComponent(key.split('/').pop() || 'fichier');

  try {
    const obj = await r2Client.send(new GetObjectCommand({ 
      Bucket: process.env.S3_BUCKET || 'sceau-storage', 
      Key: key 
    }));
    
    if (!obj.Body) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

    let stream: ReadableStream;
    if (obj.Body instanceof Readable) {
      stream = Readable.toWeb(obj.Body) as unknown as ReadableStream;
    } else {
      stream = obj.Body as unknown as ReadableStream;
    }

    const safe = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

    return new NextResponse(stream, {
      headers: {
        'Content-Type': obj.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': obj.ContentLength ? String(obj.ContentLength) : '',
      },
    });
  } catch (e) {
    console.error('[files/download]', e);
    // Fallback : si c'est une URL directe Supabase, on redirige
    if (rawUrl.includes('supabase.co')) {
        return NextResponse.redirect(rawUrl);
    }
    return NextResponse.json({ error: 'Erreur téléchargement : ' + (e as Error).message }, { status: 500 });
  }
}
