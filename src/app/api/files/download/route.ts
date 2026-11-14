import { NextResponse } from 'next/server';
import { r2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');
  if (!rawUrl) return NextResponse.json({ error: 'url requis' }, { status: 400 });

  // Extraction de la clé
  let key = rawUrl.split('/').slice(-2).join('/');
  if (rawUrl.includes('/seal/')) {
      key = rawUrl.substring(rawUrl.indexOf('/seal/') + 1);
  }

  const filename = decodeURIComponent(key.split('/').pop() || 'fichier');
  const safe = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

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

    return new NextResponse(stream, {
      headers: {
        // On force TOUJOURS le téléchargement, peu importe le type de fichier
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': obj.ContentLength ? String(obj.ContentLength) : '',
      },
    });
  } catch (e) {
    console.error('[files/download]', e);
    if (rawUrl.includes('supabase.co')) {
        return NextResponse.redirect(rawUrl);
    }
    return NextResponse.json({ error: 'Erreur téléchargement : ' + (e as Error).message }, { status: 500 });
  }
}
