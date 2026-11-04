import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { hash } = await req.json();
    const result = await pool.query(`
      SELECT s.title, s.timestamp, u.handle as author
      FROM seals s
      JOIN users u ON s.author_id = u.id
      WHERE encode(s.hash, 'base64') = $1
    `, [hash]);

    if (result.rows.length > 0) {
      return NextResponse.json({ found: true, seal: result.rows[0] });
    } else {
      return NextResponse.json({ found: false });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Erreur vérification' }, { status: 500 });
  }
}
