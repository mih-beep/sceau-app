import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sigs = await pool.query(
    `SELECT u.handle, s.created_at
     FROM pact_signatures s JOIN users u ON s.user_id = u.id
     WHERE s.pact_id = $1
     ORDER BY s.created_at ASC`,
    [id],
  );

  const pact = await pool.query(
    `SELECT media_urls FROM pacts WHERE id = $1`,
    [id],
  );

  let mediaUrls: string[] = [];
  if (pact.rows.length > 0) {
    try {
      mediaUrls = Array.isArray(pact.rows[0].media_urls)
        ? pact.rows[0].media_urls
        : JSON.parse(pact.rows[0].media_urls || '[]');
    } catch { mediaUrls = []; }
  }

  // Calcul du hash individuel de chaque fichier (approximatif depuis URL)
  const files = mediaUrls.map((url: string) => {
    const name = decodeURIComponent(url.split('/').pop() || 'fichier');
    return { name, size: 0, hash: 'voir SHA-256 telecharge', url };
  });

  return NextResponse.json({
    signataires: sigs.rows.map((r) => ({
      handle: r.handle,
      signedAt: r.created_at,
    })),
    files,
    merkleRoot: 'calcul cote client',
  });
}
