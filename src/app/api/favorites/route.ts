import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ favorites: [] });
    
    const result = await pool.query(`
      SELECT s.id, s.title, s.description, s.category, s.timestamp, u.handle as author
      FROM favorites f
      JOIN seals s ON f.seal_id = s.id
      JOIN users u ON s.author_id = u.id
      WHERE f.user_id = $1 ORDER BY f.created_at DESC
    `, [user.rows[0].id]);
    return NextResponse.json({ favorites: result.rows });
  } catch (error) { return NextResponse.json({ favorites: [] }); }
}

export async function POST(req: Request) {
  const { seal_id, pubkey, action } = await req.json(); // action: 'add' | 'remove'
  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    if (action === 'remove') {
      await pool.query("DELETE FROM favorites WHERE user_id = $1 AND seal_id = $2", [user.rows[0].id, seal_id]);
    } else {
      await pool.query("INSERT INTO favorites (user_id, seal_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.rows[0].id, seal_id]);
    }
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
