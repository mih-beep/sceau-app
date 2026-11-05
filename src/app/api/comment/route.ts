import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { seal_id, pubkey, content } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  await pool.query("INSERT INTO comments (seal_id, user_id, content) VALUES ($1, $2, $3)", [seal_id, user.rows[0].id, content]);
  return NextResponse.json({ success: true });
}
