import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT s.id, s.title, s.file_path, s.category, s.is_hosted,
             u.handle as author, s.timestamp
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.visibility = 'public'
        AND s.is_ephemeral = TRUE
        AND s.timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY s.timestamp DESC
      LIMIT 20
    `);
    return NextResponse.json({ stories: result.rows });
  } catch (error) {
    console.error('[stories]', error);
    return NextResponse.json({ stories: [] });
  }
}
