import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const myHandle = searchParams.get('me');
  const category = searchParams.get('category');

  try {
    let params: any[] = [];
    let whereClause = "s.visibility = 'public'";

    if (category && category !== 'all') {
      params.push(category);
      whereClause += ` AND s.category = $${params.length}`;
    }

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
          if (category && category !== 'all') {
             whereClause += ` AND s.category = $${params.length - 1}`; // On garde le filtre catégorie
          }
        }
      }
    }

    const sql = `
      SELECT s.id, 
        CASE WHEN s.is_mystery = true THEN '🔒 Sceau Mystère' ELSE s.title END as title,
        CASE WHEN s.is_mystery = true AND (SELECT COUNT(*) FROM likes WHERE seal_id = s.id) < s.unlock_likes THEN null ELSE s.file_path END as file_path,
        s.is_mystery, s.unlock_likes, s.is_flash, s.is_ephemeral, s.ots_proof,
        s.description, s.category, s.timestamp, s.visibility, encode(s.hash, 'base64') as hash, u.handle as author,
        s.project_id, s.version_number,
        (SELECT COUNT(*) FROM likes WHERE seal_id = s.id AND reaction_type = 'like') as likes_like,
        (SELECT COUNT(*) FROM likes WHERE seal_id = s.id AND reaction_type = 'wow') as likes_wow,
        (SELECT COUNT(*) FROM likes WHERE seal_id = s.id AND reaction_type = 'inspired') as likes_inspired,
        (SELECT COUNT(*) FROM likes WHERE seal_id = s.id AND reaction_type = 'laugh') as likes_laugh
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE ${whereClause} ORDER BY s.timestamp DESC LIMIT 30
    `;
    
    const result = await pool.query(sql, params);
    return NextResponse.json({ seals: result.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
