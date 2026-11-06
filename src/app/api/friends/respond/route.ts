import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { me, target, action } = await req.json(); // action: 'accept' | 'reject'
  try {
    const meId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0].id;
    const targetId = (await pool.query("SELECT id FROM users WHERE handle = $1", [target])).rows[0].id;

    if (action === 'accept') {
      await pool.query(`
        UPDATE friendships SET status = 'accepted' 
        WHERE requester_id = $1 AND addressee_id = $2
      `, [targetId, meId]);
    } else {
      await pool.query(`
        DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2
      `, [targetId, meId]);
    }
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
