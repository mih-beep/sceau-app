import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT s.id, s.title, s.timestamp, u.handle as author
      FROM seals s
      JOIN users u ON s.author_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 50
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur feed' }, { status: 500 });
  }
}
