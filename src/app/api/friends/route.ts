import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const me = searchParams.get('me');
  const search = searchParams.get('search');
  if (!me) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  try {
    const myIdRes = await pool.query("SELECT id FROM users WHERE handle = $1", [me]);
    if (myIdRes.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    const myId = myIdRes.rows[0].id;

    // Si on fait une recherche d'utilisateurs
    if (search) {
      const users = await pool.query(`
        SELECT handle, role FROM users 
        WHERE handle ILIKE $1 AND id != $2 LIMIT 10
      `, [`%${search}%`, myId]);
      return NextResponse.json({ searchResults: users.rows });
    }

    // Sinon, on récupère les amis ET leur dernière œuvre
    const friends = await pool.query(`
      SELECT u.id, u.handle, 
      (SELECT title FROM seals WHERE author_id = u.id AND visibility = 'public' ORDER BY created_at DESC LIMIT 1) as last_seal,
      (SELECT id FROM seals WHERE author_id = u.id AND visibility = 'public' ORDER BY created_at DESC LIMIT 1) as last_seal_id
      FROM friendships f
      JOIN users u ON (u.id = f.requester_id OR u.id = f.addressee_id)
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted' AND u.id != $1
    `, [myId]);

    const received = await pool.query(`
      SELECT u.handle FROM friendships f JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
    `, [myId]);

    return NextResponse.json({ friends: friends.rows, received: received.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const { me, target } = await req.json();
  try {
    const meId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0].id;
    const targetId = (await pool.query("SELECT id FROM users WHERE handle = $1", [target])).rows[0].id;
    
    await pool.query(`
      INSERT INTO friendships (requester_id, addressee_id, status) 
      VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING
    `, [meId, targetId]);
    
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
