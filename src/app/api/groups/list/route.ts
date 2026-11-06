import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const me = searchParams.get('me');
  if (!me) return NextResponse.json({ groups: [] });

  try {
    const myId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0]?.id;
    if (!myId) return NextResponse.json({ groups: [] });

    const groups = await pool.query(`
      SELECT g.id, g.name, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = $1 ORDER BY g.created_at DESC
    `, [myId]);
    
    return NextResponse.json({ groups: groups.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
