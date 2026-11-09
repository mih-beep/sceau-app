import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ activities: [] });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ activities: [] });
    const userId = user.rows[0].id;

    const res = await pool.query(`
      SELECT 
        a.action,
        a.context,
        a.created_at,
        u.handle as viewer_handle,
        u.created_at as viewer_created_at,
        s.title as seal_title,
        s.id as seal_id
      FROM access_log a
      JOIN seals s ON a.seal_id = s.id
      JOIN users u ON a.viewer_id = u.id
      WHERE s.author_id = $1
      ORDER BY a.created_at DESC
      LIMIT 5
    `, [userId]);

    const activities = res.rows.map((r: any) => {
      const daysOld = Math.floor((Date.now() - new Date(r.viewer_created_at).getTime()) / 86400000);
      return {
        action: r.action,
        context: r.context,
        viewer: r.viewer_handle,
        seal_title: r.seal_title,
        seal_id: r.seal_id,
        created_at: r.created_at,
        is_new_account: daysOld < 7,
        days_old: daysOld,
      };
    });

    return NextResponse.json({ activities });
  } catch (e) {
    return NextResponse.json({ activities: [] });
  }
}
