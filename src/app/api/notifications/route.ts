import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const me = searchParams.get('me');
  if (!me) return NextResponse.json({ notifications: [], unread: 0 });

  try {
    const myId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0]?.id;
    if (!myId) return NextResponse.json({ notifications: [], unread: 0 });

    const result = await pool.query(`
      SELECT n.id, n.type, n.message, n.link, n.is_read, n.created_at, u.handle as actor
      FROM notifications n JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 20
    `, [myId]);

    const unread = result.rows.filter(n => !n.is_read).length;
    return NextResponse.json({ notifications: result.rows, unread });
  } catch (error) { return NextResponse.json({ notifications: [], unread: 0 }); }
}
