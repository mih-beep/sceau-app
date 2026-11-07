import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const viewerPubkey = searchParams.get('viewer');

  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.description, s.category, s.timestamp,
              s.is_hosted, s.file_path, s.ots_proof,
              s.version_number, s.project_id,
              encode(s.hash, 'base64') as hash,
              encode(s.hash, 'hex') as hash_hex,
              u.handle as author
       FROM seals s JOIN users u ON s.author_id = u.id
       WHERE s.id = $1 AND s.visibility = 'public'`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    if (viewerPubkey) {
      const viewer = await pool.query(
        "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
        [viewerPubkey]
      );
      if (viewer.rows.length > 0) {
        await pool.query(
          "INSERT INTO access_log (seal_id, viewer_id, action, context) VALUES ($1, $2, 'view', 'public')",
          [id, viewer.rows[0].id]
        );
      }
    }

    const { ots_proof, ...seal } = result.rows[0];
    return NextResponse.json({
      seal: { ...seal, has_ots_proof: !!ots_proof },
    });
  } catch (e) {
    console.error('[o/[id]]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
