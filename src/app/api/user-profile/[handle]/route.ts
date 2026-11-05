import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  
  try {
    const user = await pool.query("SELECT id, handle FROM users WHERE handle = $1", [handle]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    
    const seals = await pool.query(`
      SELECT id, title, description, timestamp, is_hosted, file_path 
      FROM seals WHERE author_id = $1 AND is_public = TRUE ORDER BY created_at DESC
    `, [user.rows[0].id]);

    return NextResponse.json({ handle: user.rows[0].handle, seals: seals.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
