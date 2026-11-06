import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const myHandle = searchParams.get('me');
  const category = searchParams.get('cat') || '';

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

    let sql = `
      SELECT s.id, s.title, s.description, s.category, s.is_hosted, s.file_path, s.timestamp, s.visibility, u.handle as author,
      (SELECT COUNT(*) FROM likes WHERE seal_id = s.id) as likes_count
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE ${whereClause}
    `;
    
    if (category && category !== 'Tout') {
      sql += ` AND s.category = $${params.length + 1}`;
      params.push(category);
    }

    sql += ` ORDER BY s.timestamp DESC LIMIT 30`;
    const result = await pool.query(sql, params);
    return NextResponse.json({ seals: result.rows });
  } catch (error) { 
    return NextResponse.json({ error: 'Erreur' }, { status: 500 }); 
  }
}
