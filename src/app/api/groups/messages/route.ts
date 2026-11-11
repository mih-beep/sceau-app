import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('id');
  if (!groupId) return NextResponse.json({ messages: [] });

  try {
    const messages = await pool.query(`
      SELECT m.content, m.created_at, u.handle as sender
      FROM group_messages m JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = $1 ORDER BY m.created_at ASC
    `, [groupId]);
    return NextResponse.json({ messages: messages.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const { group_id, sender_handle, content, is_audio, iv } = await req.json();
  try {
    const senderId = (await pool.query("SELECT id FROM users WHERE handle = $1", [sender_handle])).rows[0]?.id;
    await pool.query(
      "INSERT INTO group_messages (group_id, sender_id, content, is_audio, iv) VALUES ($1, $2, $3, $4, $5)",
      [group_id, senderId, content, is_audio === true, iv || null]
    );
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
