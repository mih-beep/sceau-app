import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { pact_id, pubkey } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  try {
    await pool.query("INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [pact_id, user.rows[0].id]);

    // On regarde combien on a de signatures et combien il en faut
    const pact = await pool.query("SELECT required_signatures, status FROM pacts WHERE id = $1", [pact_id]);
    const sigs = await pool.query("SELECT COUNT(*) as count FROM pact_signatures WHERE pact_id = $1", [pact_id]);
    
    const required = pact.rows[0].required_signatures;
    const current = parseInt(sigs.rows[0].count);

    if (current >= required && pact.rows[0].status !== 'scelle') {
      const now = new Date().toISOString();
      await pool.query("UPDATE pacts SET status = 'scelle', created_at = $1 WHERE id = $2", [now, pact_id]);
    }

    return NextResponse.json({ success: true, current, required });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
