import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { creation_id, pubkey } = await req.json();
    if (!creation_id || !pubkey) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const userId = user.rows[0].id;

    // Vérifier si le like existe déjà
    const existing = await pool.query("SELECT 1 FROM creation_likes WHERE attachment_id = $1 AND user_id = $2", [creation_id, userId]);
    
    if (existing.rows.length > 0) {
      // On retire le like
      await pool.query("DELETE FROM creation_likes WHERE attachment_id = $1 AND user_id = $2", [creation_id, userId]);
      return NextResponse.json({ liked: false });
    } else {
      // On ajoute le like
      await pool.query("INSERT INTO creation_likes (attachment_id, user_id) VALUES ($1, $2)", [creation_id, userId]);
      return NextResponse.json({ liked: true });
    }
  } catch (e) {
    console.error('[creation_like]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
