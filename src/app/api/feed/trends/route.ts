import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    // On récupère les œuvres publiques de la semaine, triées par nombre de likes
    const result = await pool.query(`
      SELECT s.id, s.title, s.category, s.timestamp, s.location, u.handle as author,
      (SELECT COUNT(*) FROM likes WHERE seal_id = s.id) as likes_count
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.is_public = TRUE AND s.timestamp >= NOW() - INTERVAL '7 days'
      ORDER BY likes_count DESC, s.timestamp DESC
      LIMIT 3
    `);
    return NextResponse.json({ trends: result.rows });
  } catch (error) { 
    return NextResponse.json({ error: 'Erreur' }, { status: 500 }); 
  }
}
