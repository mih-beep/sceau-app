import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const me = searchParams.get('me');

  if (!q || q.length < 2) return NextResponse.json({ users: [] });

  try {
    const result = await pool.query(`
      SELECT handle, role, bio 
      FROM users 
      WHERE handle ILIKE $1 AND handle != $2
      LIMIT 10
    `, [`%${q}%`, me || '']);
    
    return NextResponse.json({ users: result.rows });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
