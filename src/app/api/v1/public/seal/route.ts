import { NextResponse } from 'next/server';
import { anchorToBitcoin, hashDocument } from '@/lib/sceau-protocol';

export const runtime = 'nodejs';
export const maxDuration = 30;

const LIMIT = 10;
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 5_000;
const MAX_BYTES = 4 * 1024 * 1024;

type Entry = { count: number; resetAt: number };
const ipCache = new Map<string, Entry>();

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

function rateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  if (ipCache.size > MAX_ENTRIES) {
    for (const [k, v] of ipCache) if (v.resetAt < now) ipCache.delete(k);
    while (ipCache.size > MAX_ENTRIES) {
      const first = ipCache.keys().next().value;
      if (first === undefined) break;
      ipCache.delete(first);
    }
  }
  let e = ipCache.get(ip);
  if (!e || e.resetAt < now) {
    e = { count: 0, resetAt: now + WINDOW_MS };
    ipCache.set(ip, e);
  }
  if (e.count >= LIMIT) return { ok: false, retryAfter: Math.ceil((e.resetAt - now) / 1000) };
  e.count++;
  return { ok: true };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Trop de requêtes. Réessayez dans ${rl.retryAfter}s.` },
      { status: 429, headers: { ...CORS, 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  try {
    const len = req.headers.get('content-length');
    if (len && parseInt(len, 10) > MAX_BYTES) {
      return NextResponse.json({ error: 'Fichier trop lourd (max 4 Mo)' }, { status: 413, headers: CORS });
    }
    const data = await req.formData();
    const file = data.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400, headers: CORS });
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Fichier vide ou trop lourd (max 4 Mo).' }, { status: 413, headers: CORS });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hashHex = hashDocument(new Uint8Array(buffer));
    const { otsProof, calendars } = await anchorToBitcoin(hashHex);

    return NextResponse.json({
      success: true,
      protocol: 'SCEAU v1.0',
      document: { name: file.name, hash_sha256: hashHex },
      bitcoin_anchor: {
        secured: otsProof !== null,
        ots_proof_base64: otsProof,
        calendars_used: calendars,
      },
    }, { headers: CORS });
  } catch (e) {
    console.error('[public/seal]', e);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500, headers: CORS });
  }
}
