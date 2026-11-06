import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

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

    return NextResponse.redirect(res.rows[0].file_path);
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
