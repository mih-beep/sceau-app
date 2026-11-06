import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const myHandle = searchParams.get('me');

  if (!myHandle) return NextResponse.json({ friends_seals: [] });

  try {
    // 1. On trouve l'ID de l'utilisateur
    const me = await pool.query("SELECT id FROM users WHERE handle = $1", [myHandle]);
    if (me.rows.length === 0) return NextResponse.json({ friends_seals: [] });
    const myId = me.rows[0].id;

    // 2. On trouve les gens avec qui j'ai discuté (mes contacts)
    const contactsQuery = await pool.query(`
      SELECT DISTINCT receiver_id as contact_id FROM messages WHERE sender_id = $1
      UNION
      SELECT DISTINCT sender_id as contact_id FROM messages WHERE receiver_id = $1
    `, [myId]);

    if (contactsQuery.rows.length === 0) return NextResponse.json({ friends_seals: [] });
    const contactIds = contactsQuery.rows.map(r => r.contact_id);

    // 3. On récupère leurs dernières œuvres publiques (5 max)
    const seals = await pool.query(`
      SELECT s.id, s.title, s.timestamp, u.handle as author
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.author_id = ANY($1) AND s.is_public = TRUE
      ORDER BY s.timestamp DESC LIMIT 5
    `, [contactIds]);

    return NextResponse.json({ friends_seals: seals.rows });
  } catch (error) { 
    return NextResponse.json({ error: 'Erreur' }, { status: 500 }); 
  }
}
