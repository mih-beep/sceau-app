import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const query = `%${q}%`;
    const result = await pool.query(`
      SELECT s.id, s.title, s.description, s.category, s.timestamp, u.handle as author,
             encode(s.hash, 'base64') as hash
      FROM seals s 
      JOIN users u ON s.author_id = u.id
      WHERE (s.title ILIKE $1 OR s.description ILIKE $1 OR u.handle ILIKE $1) 
        AND s.visibility = 'public'
      ORDER BY s.timestamp DESC
      LIMIT 20
    `, [query]);

    return NextResponse.json({ results: result.rows });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur de recherche' }, { status: 500 });
  }
}
