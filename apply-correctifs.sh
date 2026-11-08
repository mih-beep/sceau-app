#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

mkdir -p src/lib src/db
mkdir -p "src/app/api/seal/delete"
mkdir -p "src/app/api/seal/[id]/ots/refresh"
mkdir -p "src/app/api/download/[id]"
mkdir -p "src/app/api/pacts/create"
mkdir -p "src/app/api/v1/public/seal"

# ---------------------------------------------------------------
say "1/12 → src/lib/env.ts"
cat > src/lib/env.ts << 'EOF'
// Validation centralisée des variables d'environnement.
// Échoue TÔT avec un message clair au lieu de produire `undefined/undefined/clé`.

function clean(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return v.trim().replace(/^['"]|['"]$/g, '');
}

function required(name: string): string {
  const v = clean(process.env[name]);
  if (!v) throw new Error(`Variable d'environnement manquante ou vide : ${name}`);
  return v;
}

function optional(name: string, def = ''): string {
  return clean(process.env[name]) ?? def;
}

export function requireS3(): { endpoint: string; bucket: string; region: string } {
  const endpoint = required('AWS_ENDPOINT_URL_S3').replace(/\/$/, '');
  const bucket = required('S3_BUCKET').replace(/^\/+|\/+$/g, '');
  const region = optional('AWS_REGION', 'us-west-004');
  return { endpoint, bucket, region };
}

export function requireDb(): string {
  return required('DATABASE_URL');
}
EOF

# ---------------------------------------------------------------
say "2/12 → src/lib/api-error.ts"
cat > src/lib/api-error.ts << 'EOF'
import { NextResponse } from 'next/server';

function isDbError(e: any): boolean {
  const code = e?.code;
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '3D000', '57P01'].includes(code)) return true;
  return /ECONNREFUSED|ENOTFOUND|timeout|connect.*pool|database/i.test(String(e?.message || ''));
}

export function apiError(e: unknown, fallback = 'Erreur serveur'): NextResponse {
  if (isDbError(e)) {
    console.error('[api-error] base injoignable :', (e as any)?.message);
    return NextResponse.json(
      { error: 'Base de données injoignable. Réessayez dans un instant.' },
      { status: 503 }
    );
  }
  console.error('[api-error]', e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
EOF

# ---------------------------------------------------------------
say "3/12 → src/lib/safe-key.ts"
cat > src/lib/safe-key.ts << 'EOF'
export function safeKeyPart(input: string, maxLen = 80): string {
  if (!input) return 'file';
  const ascii = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = ascii.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const safe = cleaned.replace(/^\.+/, '').replace(/\.{2,}/g, '.').replace(/-+/g, '-');
  return (safe || 'file').slice(0, maxLen);
}

export function buildS3Key(opts: {
  authorId: string; hashBase64: string; originalName: string; prefix?: string;
}): string {
  const prefix = opts.prefix || 'seal';
  const authorShort = opts.authorId.replace(/-/g, '').slice(0, 8);
  const hashShort = opts.hashBase64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  const safeName = safeKeyPart(opts.originalName, 80);
  return `${prefix}/${authorShort}/${hashShort}-${safeName}`;
}

export function extractS3Key(filePath: string): string | null {
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || '').replace(/\/$/, '');
  const bucket = (process.env.S3_BUCKET || '').replace(/^\/+|\/+$/g, '');
  const prefix = `${endpoint}/${bucket}/`;
  if (filePath.startsWith(prefix)) return filePath.slice(prefix.length);
  return filePath.split('/').pop() || null;
}
EOF

# ---------------------------------------------------------------
say "4/12 → src/db/pool.ts"
cat > src/db/pool.ts << 'EOF'
import { Pool } from 'pg';
import { requireDb } from '@/lib/env';

let _pool: Pool | null = null;

function create(): Pool {
  const url = requireDb();
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: true },
  });
  pool.on('error', (err) => {
    console.error('[pg] idle client error:', err.message);
  });
  return pool;
}

export function getPool(): Pool {
  if (!_pool) _pool = create();
  return _pool;
}

// Compat : `import { pool } from '@/db/pool'` continue de fonctionner.
export const pool = new Proxy({} as Pool, {
  get(_t, prop) {
    const real = getPool() as any;
    const v = real[prop];
    return typeof v === 'function' ? v.bind(real) : v;
  },
});
EOF

# ---------------------------------------------------------------
say "5/12 → src/lib/r2.ts"
cat > src/lib/r2.ts << 'EOF'
import { S3Client } from '@aws-sdk/client-s3';
import { requireS3 } from '@/lib/env';

let _client: S3Client | null = null;

function create(): S3Client {
  const { endpoint, region } = requireS3();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Clés S3 manquantes : AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY');
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export function getR2Client(): S3Client {
  if (!_client) _client = create();
  return _client;
}

export const r2Client = new Proxy({} as S3Client, {
  get(_t, prop) {
    const real = getR2Client() as any;
    const v = real[prop];
    return typeof v === 'function' ? v.bind(real) : v;
  },
});
EOF

# ---------------------------------------------------------------
say "6/12 → src/lib/ots.ts"
cat > src/lib/ots.ts << 'EOF'
// En-tête .ots complet (31 octets) :
// \x00 + "OpenTimestamps" (14) + \x00\x00 + "Proof" (5) + \x00 + 8 octets magiques
const HEADER_MAGIC = Buffer.from(
  '004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294',
  'hex'
);

const CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];

const CALENDAR_TIMEOUT_MS = 8_000;
const MAX_PROOF_BYTES = 64 * 1024;

export type OtsResult = {
  ok: boolean;
  proof?: Buffer;
  calendars: string[];
  error?: string;
};

function toDetachedOts(hash: Uint8Array, calendarBody: Buffer): Buffer {
  if (calendarBody.length >= HEADER_MAGIC.length &&
      calendarBody.subarray(0, HEADER_MAGIC.length).equals(HEADER_MAGIC)) {
    return calendarBody;
  }
  return Buffer.concat([
    HEADER_MAGIC,
    Buffer.from([0x01, 0x08]), // version 1 + op SHA-256
    Buffer.from(hash),
    calendarBody,
  ]);
}

async function submitOne(url: string, hash: Uint8Array): Promise<Buffer> {
  const res = await fetch(`${url}/digest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      Accept: 'application/vnd.opentimestamps.v1',
      'User-Agent': 'sceau/1.0',
    },
    body: Buffer.from(hash),
    signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_PROOF_BYTES) throw new Error('taille invalide');
  if (buf[0] === 0x3c || buf[0] === 0x7b) throw new Error('réponse non binaire (HTML/JSON)');
  return buf;
}

export async function submitToOts(hash: Uint8Array): Promise<OtsResult> {
  if (hash.length !== 32) return { ok: false, calendars: [], error: 'hash_invalid_length' };

  const settled = await Promise.allSettled(CALENDARS.map((u) => submitOne(u, hash)));

  const successes: string[] = [];
  let body: Buffer | undefined;
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      successes.push(CALENDARS[i]);
      if (!body) body = r.value;
    }
  });

  if (!body) return { ok: false, calendars: successes, error: 'all_calendars_failed' };
  return { ok: true, proof: toDetachedOts(hash, body), calendars: successes };
}

// Upgrade : interroge les calendars avec le hash de l'ENGAGEMENT contenu dans la preuve
// (pas le hash du fichier — sinon ça ne confirme jamais).
export async function upgradeOts(hash: Uint8Array, proofBase64: string): Promise<Buffer | null> {
  let engagement: Uint8Array = hash;
  try {
    const raw = Buffer.from(proofBase64, 'base64');
    if (raw.length > HEADER_MAGIC.length + 34 &&
        raw.subarray(0, HEADER_MAGIC.length).equals(HEADER_MAGIC)) {
      const version = raw[HEADER_MAGIC.length];
      const op = raw[HEADER_MAGIC.length + 1];
      if (version === 0x01 && op === 0x08) {
        engagement = raw.subarray(HEADER_MAGIC.length + 2, HEADER_MAGIC.length + 34);
      }
    }
  } catch { /* fallback hash */ }

  const hashHex = Buffer.from(engagement).toString('hex');
  const settled = await Promise.allSettled(
    CALENDARS.map(async (url) => {
      const res = await fetch(`${url}/timestamp/${hashHex}`, {
        signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_PROOF_BYTES) throw new Error('taille invalide');
      return buf;
    })
  );

  let best: Buffer | null = null;
  for (const r of settled) {
    if (r.status === 'fulfilled' && (!best || r.value.length > best.length)) best = r.value;
  }
  return best;
}
EOF

# ---------------------------------------------------------------
say "7/12 → src/app/api/seal/route.ts"
cat > src/app/api/seal/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { submitToOts } from '@/lib/ots';
import { buildS3Key } from '@/lib/safe-key';
import { apiError } from '@/lib/api-error';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  let uploadedKey: string | null = null;
  try {
    const data = await req.formData();
    const hash = data.get('hash') as string;
    const title = ((data.get('title') as string) || '').trim();
    const description = ((data.get('description') as string) || '').trim();
    const isFlash = data.get('isFlash') === 'true';
    const isMystery = data.get('isMystery') === 'true';
    const isEphemeral = data.get('isEphemeral') === 'true';
    const unlockLikes = parseInt((data.get('unlockLikes') as string) || '0', 10);
    const pubkey = data.get('pubkey') as string;
    const projectIdInput = (data.get('project_id') as string) || null;
    const challengeId = (data.get('challenge_id') as string) || null;
    const visibilityInput = (data.get('visibility') as string) || 'public';
    const file = data.get('file') as File | null;

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!['public', 'private', 'friends'].includes(visibilityInput)) {
      return NextResponse.json({ error: 'Visibilité invalide' }, { status: 400 });
    }

    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id as string;

    let otsProof: string | null = null;
    try {
      const ots = await submitToOts(new Uint8Array(Buffer.from(hash, 'base64')));
      if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
      else console.warn('[OTS] échec :', ots.error);
    } catch (e) { console.warn('[OTS] exception :', e); }

    let filePath: string | null = null;
    let fileSize = 0;
    if (!isFlash && file && file.size > 0) {
      const quota = await pool.query(
        "SELECT COALESCE(SUM(file_size), 0) as used FROM seals WHERE author_id = $1 AND is_hosted = true",
        [authorId]
      );
      if (parseInt(quota.rows[0].used, 10) + file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'Quota de 50 Mo dépassé.' }, { status: 403 });
      }
      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadedKey = buildS3Key({ authorId, hashBase64: hash, originalName: file.name });
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: uploadedKey,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        ContentLength: buffer.length,
      }));
      const { endpoint, bucket } = requireS3();
      filePath = `${endpoint}/${bucket}/${uploadedKey}`;
    }

    const client = await pool.connect();
    let sealId: string;
    let projectId: string | null = null;
    let versionNumber = 1;

    try {
      await client.query('BEGIN');

      if (projectIdInput && !isFlash) {
        const ref = await client.query(
          "SELECT id, project_id, author_id FROM seals WHERE id = $1",
          [projectIdInput]
        );
        if (ref.rows.length > 0 && ref.rows[0].author_id === authorId) {
          if (ref.rows[0].project_id) {
            projectId = ref.rows[0].project_id;
          } else {
            const np = await client.query(
              "INSERT INTO projects (author_id, name) VALUES ($1, $2) RETURNING id",
              [authorId, title]
            );
            projectId = np.rows[0].id;
            await client.query(
              "UPDATE seals SET project_id = $1, version_number = 1 WHERE id = $2",
              [projectId, projectIdInput]
            );
          }
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [projectId]);
          const maxV = await client.query(
            "SELECT COALESCE(MAX(version_number), 0) as m FROM seals WHERE project_id = $1",
            [projectId]
          );
          versionNumber = (maxV.rows[0].m || 0) + 1;
        }
      }

      const result = await client.query(
        `INSERT INTO seals (
          hash, timestamp, author_id, title, description, is_public, visibility,
          is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral,
          ots_proof, ots_submitted_at, project_id, version_number, challenge_id
        ) VALUES (
          decode($1, 'base64'), NOW(), $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18
        ) RETURNING id`,
        [
          hash, authorId, title, description,
          visibilityInput === 'public', visibilityInput,
          !isFlash && filePath ? true : false, filePath, fileSize,
          isFlash, isMystery, unlockLikes, isEphemeral,
          otsProof, otsProof ? new Date() : null,
          projectId, versionNumber, challengeId,
        ]
      );
      sealId = result.rows[0].id;

      if (challengeId) {
        const cc = await client.query(
          "SELECT id, deadline FROM challenges WHERE id = $1",
          [challengeId]
        );
        if (cc.rows.length > 0 && new Date(cc.rows[0].deadline) > new Date()) {
          await client.query(
            "INSERT INTO challenge_entries (challenge_id, user_id, seal_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [challengeId, authorId, sealId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      if (uploadedKey) {
        r2Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: uploadedKey }))
          .catch(() => { /* fichier orphelin déjà supprimé */ });
      }
      if (e?.code === '23505' && /unique_seal/.test(String(e?.constraint || ''))) {
        return NextResponse.json({ error: 'Ce fichier a déjà été scellé par vous.' }, { status: 409 });
      }
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({
      seal_id: sealId,
      ots_secured: otsProof !== null,
      project_id: projectId,
      version_number: versionNumber,
      challenge_id: challengeId,
    });
  } catch (e) {
    return apiError(e, 'Erreur lors du scellement');
  }
}
EOF

# ---------------------------------------------------------------
say "8/12 → src/app/api/seal/delete/route.ts"
cat > src/app/api/seal/delete/route.ts << 'EOF'
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
EOF

# ---------------------------------------------------------------
say "9/12 → src/app/api/download/[id]/route.ts"
cat > "src/app/api/download/[id]/route.ts" << 'EOF'
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
EOF

# ---------------------------------------------------------------
say "10/12 → src/app/api/seal/[id]/ots/refresh/route.ts"
cat > "src/app/api/seal/[id]/ots/refresh/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { upgradeOts } from '@/lib/ots';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await pool.query("SELECT hash, ots_proof FROM seals WHERE id = $1", [id]);
    if (res.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const row = res.rows[0];
    if (!row.ots_proof) {
      return NextResponse.json({ status: 'no_proof', message: 'Aucune preuve .ots stockée.' });
    }

    const upgraded = await upgradeOts(new Uint8Array(row.hash), row.ots_proof);
    if (!upgraded) {
      return NextResponse.json({ status: 'pending', message: 'Pas encore confirmé. Réessaie dans quelques heures.' });
    }

    await pool.query(
      "UPDATE seals SET ots_proof = $1, ots_upgraded_at = NOW() WHERE id = $2",
      [upgraded.toString('base64'), id]
    );
    return NextResponse.json({ status: 'upgraded', size: upgraded.length });
  } catch (e) {
    return apiError(e, 'Erreur lors de la mise à jour de la preuve');
  }
}
EOF

# ---------------------------------------------------------------
say "11/12 → src/app/api/pacts/create/route.ts"
cat > src/app/api/pacts/create/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { safeKeyPart } from '@/lib/safe-key';
import { apiError } from '@/lib/api-error';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const uploadedKeys: string[] = [];
  try {
    const data = await req.formData();
    const title = ((data.get('title') as string) || '').trim();
    const description = ((data.get('description') as string) || '').trim();
    const pubkey = data.get('pubkey') as string;
    const groupId = (data.get('group_id') as string) || null;
    const requiredSignatures = parseInt((data.get('required_signatures') as string) || '2', 10);
    const hash = data.get('hash') as string;
    const files = (data.getAll('files') as File[]).filter((f) => f && f.size > 0);

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!hash) return NextResponse.json({ error: 'Hash requis' }, { status: 400 });
    if (requiredSignatures < 2 || requiredSignatures > 50) {
      return NextResponse.json({ error: 'required_signatures doit être entre 2 et 50' }, { status: 400 });
    }
    if (files.length > 10) return NextResponse.json({ error: 'Trop de fichiers (max 10)' }, { status: 400 });
    if (files.reduce((s, f) => s + f.size, 0) > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichiers trop lourds (max 4 Mo au total)' }, { status: 413 });
    }

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const creatorId = user.rows[0].id as string;
    const { endpoint, bucket } = requireS3();

    const mediaUrls: string[] = [];
    for (const file of files) {
      const safeName = safeKeyPart(file.name, 60);
      const key = `pact/${creatorId.slice(0, 8)}/${Date.now()}-${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        ContentLength: buffer.length,
      }));
      uploadedKeys.push(key);
      mediaUrls.push(`${endpoint}/${bucket}/${key}`);
    }

    const client = await pool.connect();
    let pactId: string;
    try {
      await client.query('BEGIN');
      const pact = await client.query(
        `INSERT INTO pacts (title, description, creator_id, group_id, required_signatures, hash, media_urls, is_hosted, category)
         VALUES ($1, $2, $3, $4, $5, decode($6, 'base64'), $7, $8, 'Art') RETURNING id`,
        [title, description, creatorId, groupId, requiredSignatures, hash, JSON.stringify(mediaUrls), mediaUrls.length > 0]
      );
      pactId = pact.rows[0].id;
      await client.query(
        "INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [pactId, creatorId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      for (const key of uploadedKeys) {
        r2Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })).catch(() => {});
      }
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ id: pactId, title });
  } catch (e) {
    return apiError(e, 'Erreur lors de la création du pacte');
  }
}
EOF

# ---------------------------------------------------------------
say "12/12 → src/app/api/v1/public/seal/route.ts"
cat > src/app/api/v1/public/seal/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { anchorToBitcoin, hashDocument } from '../../../../../../sceau-protocol/src/index';

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
EOF

echo ""
echo -e "${GREEN}✅ 12 fichiers écrits.${NC}"
echo ""
echo -e "${YELLOW}Vérification :${NC}"
npm run typecheck && echo -e "${GREEN}✅ Typecheck OK${NC}" || echo -e "${RED}❌ Typecheck KO — colle-moi l'erreur${NC}"
echo ""
echo -e "${YELLOW}Prochaine étape :${NC} npm run build"
