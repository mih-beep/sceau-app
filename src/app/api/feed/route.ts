import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('cat') || '';
  const timeFilter = searchParams.get('time') || 'all'; // 'hour', 'day', 'week', 'all'
  const locationFilter = searchParams.get('loc') || '';

  try {
    let sql = `
      SELECT s.id, s.title, s.description, s.category, s.is_hosted, s.file_path, s.timestamp, s.location, encode(s.hash, 'base64') as hash, u.handle as author,
      (SELECT COUNT(*) FROM likes WHERE seal_id = s.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE seal_id = s.id) as comments_count
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.is_public = TRUE
    `;
    const params: any[] = [];
    
    if (query) {
      sql += ` AND (s.title ILIKE $${params.length + 1} OR s.description ILIKE $${params.length + 1} OR u.handle ILIKE $${params.length + 1})`;
      params.push(`%${query}%`);
    }
    if (category && category !== 'Tout') {
      sql += ` AND s.category = $${params.length + 1}`;
      params.push(category);
    }
    if (locationFilter) {
      sql += ` AND s.location ILIKE $${params.length + 1}`;
      params.push(`%${locationFilter}%`);
    }

    // Filtre temporel
    if (timeFilter === 'hour') {
      sql += ` AND s.timestamp >= NOW() - INTERVAL '1 hour'`;
    } else if (timeFilter === 'day') {
      sql += ` AND s.timestamp >= NOW() - INTERVAL '1 day'`;
    } else if (timeFilter === 'week') {
      sql += ` AND s.timestamp >= NOW() - INTERVAL '7 days'`;
    }

    sql += ` ORDER BY s.timestamp DESC LIMIT 50`;
    const result = await pool.query(sql, params);
    
    return NextResponse.json({ seals: result.rows });
  } catch (error) { 
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 }); 
  }
}
