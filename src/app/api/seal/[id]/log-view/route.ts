import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { pubkey, context } = await req.json();
    if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 });

    const viewer = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (viewer.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    await pool.query(
      "INSERT INTO access_log (seal_id, viewer_id, action, context) VALUES ($1, $2, 'view', $3)",
      [id, viewer.rows[0].id, context || 'feed']
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
