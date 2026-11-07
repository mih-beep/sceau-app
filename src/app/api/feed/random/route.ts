import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT s.id, s.title, s.description, s.category, s.timestamp,
             encode(s.hash, 'base64') as hash, u.handle as author,
             s.file_path, s.is_hosted
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.visibility = 'public'
        AND s.is_mystery = FALSE
        AND s.is_ephemeral = FALSE
      ORDER BY RANDOM() LIMIT 1
    `);
    if (result.rows.length === 0) {
      return NextResponse.json({ seal: null, reason: 'empty' });
    }
    return NextResponse.json({ seal: result.rows[0] });
  } catch (error) {
    console.error('[random]', error);
    return NextResponse.json({ seal: null, reason: 'error' }, { status: 500 });
  }
}
