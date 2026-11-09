import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ count: 0 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ count: 0 });
    const userId = user.rows[0].id;

    const res = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM pacts p
      LEFT JOIN pact_signatures ps ON p.id = ps.pact_id
      WHERE (p.creator_id = $1 OR ps.user_id = $1)
        AND p.status != 'scelle'
    `, [userId]);

    return NextResponse.json({ count: parseInt(res.rows[0].count || 0) });
  } catch (e) {
    return NextResponse.json({ count: 0 });
  }
}
