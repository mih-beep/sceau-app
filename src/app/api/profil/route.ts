import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id, handle FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    const userId = user.rows[0].id;

    // Les statistiques
    const stats = await pool.query(`
      SELECT COUNT(id) as total_sealed, SUM(CASE WHEN is_hosted = true THEN 1 ELSE 0 END) as total_hosted
      FROM seals WHERE author_id = $1
    `, [userId]);

    // La liste des œuvres
    const seals = await pool.query(`
      SELECT id, title, timestamp, is_hosted, file_path 
      FROM seals WHERE author_id = $1 ORDER BY created_at DESC
    `, [userId]);

    return NextResponse.json({
      handle: user.rows[0].handle,
      sealed: parseInt(stats.rows[0].total_sealed || 0),
      hosted: parseInt(stats.rows[0].total_hosted || 0),
      seals: seals.rows
    });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
