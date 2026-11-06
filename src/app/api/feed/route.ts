import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const myHandle = searchParams.get('me');

  try {
    let params: any[] = [];
    let whereClause = "s.visibility = 'public'";

    if (myHandle) {
      const me = await pool.query("SELECT id FROM users WHERE handle = $1", [myHandle]);
      if (me.rows.length > 0) {
        const myId = me.rows[0].id;
        const friendsRes = await pool.query(`
          SELECT requester_id as id FROM friendships WHERE addressee_id = $1 AND status = 'accepted'
          UNION
          SELECT addressee_id as id FROM friendships WHERE requester_id = $1 AND status = 'accepted'
        `, [myId]);
        const friendIds = friendsRes.rows.map(r => r.id);
        if (friendIds.length > 0) {
          params.push(friendIds);
          whereClause = `(s.visibility = 'public' OR (s.visibility = 'friends' AND s.author_id = ANY($${params.length})))`;
        }
      }
    }

    const sql = `
      SELECT s.id, s.title, s.description, s.category, s.is_hosted, s.file_path, s.timestamp, s.visibility, encode(s.hash, 'base64') as hash, u.handle as author,
      s.project_id, s.version_number,
      (SELECT COUNT(*) FROM likes WHERE seal_id = s.id) as likes_count
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE ${whereClause} ORDER BY s.timestamp DESC LIMIT 30
    `;
    
    const result = await pool.query(sql, params);
    return NextResponse.json({ seals: result.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
