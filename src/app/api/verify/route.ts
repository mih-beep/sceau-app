import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { hash } = await req.json();
    
    if (!hash) {
      return NextResponse.json({ error: 'Hash manquant' }, { status: 400 });
    }

    const result = await pool.query(`
      SELECT s.title, s.timestamp, s.is_hosted, s.file_path, s.category, u.handle as author
      FROM seals s 
      JOIN users u ON s.author_id = u.id
      WHERE encode(s.hash, 'base64') = $1
    `, [hash]);

    if (result.rows.length > 0) {
      return NextResponse.json({ found: true, seal: result.rows[0] });
    }
    
    return NextResponse.json({ found: false });
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 });
  }
}
