import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await pool.query(`
      SELECT s.id, s.title, s.description, s.category, s.timestamp, s.is_hosted, s.file_path, s.ots_proof, encode(s.hash, 'base64') as hash, u.handle as author
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.id = $1 AND s.visibility = 'public'
    `, [id]);

    if (result.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    return NextResponse.json({ seal: result.rows[0] });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
