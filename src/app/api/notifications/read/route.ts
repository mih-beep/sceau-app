import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { me } = await req.json();
  try {
    const myId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0]?.id;
    if (myId) await pool.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [myId]);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
