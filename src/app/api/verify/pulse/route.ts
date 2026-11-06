import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    // On récupère les 15 derniers sceaux publics
    const result = await pool.query(`
      SELECT s.id, s.title, s.category, s.timestamp, s.location, u.handle as author
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.is_public = TRUE
      ORDER BY s.timestamp DESC LIMIT 15
    `);
    return NextResponse.json({ pulse: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
