import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { seal_id, pubkey } = await req.json();
  const user = await pool.query("SELECT id, handle FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
  const myId = user.rows[0].id;

  try {
    await pool.query("INSERT INTO likes (seal_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [seal_id, myId]);
    
    // Création de la notification
    const seal = await pool.query("SELECT author_id, title FROM seals WHERE id = $1", [seal_id]);
    if (seal.rows.length > 0 && seal.rows[0].author_id !== myId) {
      await pool.query(
        "INSERT INTO notifications (user_id, actor_id, type, message, link) VALUES ($1, $2, 'like', $3, $4)",
        [seal.rows[0].author_id, myId, `a aimé ton œuvre "${seal.rows[0].title}"`, `/o/${seal_id}`]
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
