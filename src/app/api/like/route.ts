import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { seal_id, pubkey } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  try {
    // ON CONFLICT DO NOTHING permet de ne pas planter si on like 2 fois (on le retirera plus tard pour le "unlike")
    await pool.query("INSERT INTO likes (seal_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [seal_id, user.rows[0].id]);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
