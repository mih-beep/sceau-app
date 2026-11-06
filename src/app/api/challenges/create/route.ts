import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { title, description, pubkey, is_anonymous } = await req.json();
  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    // Date limite dans 7 jours par défaut
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    await pool.query(
      "INSERT INTO challenges (title, description, creator_id, deadline, is_anonymous) VALUES ($1, $2, $3, $4, $5)",
      [title, description, user.rows[0].id, deadline, is_anonymous]
    );
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
