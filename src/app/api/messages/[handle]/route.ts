import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { searchParams } = new URL(req.url);
  const myHandle = searchParams.get('me');

  try {
    const myIdResult = await pool.query("SELECT id FROM users WHERE handle = $1", [myHandle]);
    const otherIdResult = await pool.query("SELECT id FROM users WHERE handle = $1", [handle]);
    
    if (myIdResult.rows.length === 0 || otherIdResult.rows.length === 0) return NextResponse.json({ error: 'Erreur' }, { status: 400 });
    
    const myId = myIdResult.rows[0].id;
    const otherId = otherIdResult.rows[0].id;

    const messages = await pool.query(`
      SELECT m.content, m.created_at, u.handle as sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [myId, otherId]);

    return NextResponse.json({ messages: messages.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
