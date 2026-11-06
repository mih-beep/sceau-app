import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { challenge_id, entry_id, pubkey } = await req.json();
  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const voterId = user.rows[0].id;

    // Vérifier qu'il ne vote pas pour lui-même
    const entry = await pool.query("SELECT user_id FROM challenge_entries WHERE id = $1", [entry_id]);
    if (entry.rows.length > 0 && entry.rows[0].user_id === voterId) {
      return NextResponse.json({ error: 'Tu ne peux pas voter pour ta propre œuvre !' }, { status: 403 });
    }

    await pool.query(
      "INSERT INTO challenge_votes (challenge_id, voter_id, entry_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [challenge_id, voterId, entry_id]
    );
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
