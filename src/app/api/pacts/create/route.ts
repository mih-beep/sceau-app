import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { title, description, pubkey } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  const pact = await pool.query(
    "INSERT INTO pacts (title, description, creator_id) VALUES ($1, $2, $3) RETURNING id",
    [title, description, user.rows[0].id]
  );
  
  // Le créateur signe automatiquement
  await pool.query("INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2)", [pact.rows[0].id, user.rows[0].id]);
  
  return NextResponse.json({ id: pact.rows[0].id });
}
