import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { pact_id, pubkey } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  await pool.query(
    "INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", 
    [pact_id, user.rows[0].id]
  );
  return NextResponse.json({ success: true });
}
