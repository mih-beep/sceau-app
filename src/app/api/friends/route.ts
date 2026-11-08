import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let me = searchParams.get('me');
    const search = searchParams.get('search');
    
    if (!me) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    // NOUVEAU : On nettoie le pseudo au cas où il y aurait un @
    me = me.replace('@', '');

    const myIdRes = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me]);
    if (myIdRes.rows.length === 0) {
      // Message plus clair pour le débogage
      return NextResponse.json({ error: "Ton compte n'existe pas dans la base de données. Déconnecte-toi et reconnecte-toi." }, { status: 404 });
    }
    const myId = myIdRes.rows[0].id;

    if (search) {
      const users = await pool.query(`
        SELECT handle, role FROM users 
        WHERE handle ILIKE $1 AND id != $2 LIMIT 10
      `, [`%${search.replace('@', '')}%`, myId]);
      return NextResponse.json({ searchResults: users.rows });
    }

    const friendsQuery = await pool.query(`
      SELECT 
        u.id, 
        u.handle,
        (SELECT title FROM seals WHERE author_id = u.id AND visibility = 'public' ORDER BY created_at DESC LIMIT 1) as last_seal,
        (SELECT id FROM seals WHERE author_id = u.id AND visibility = 'public' ORDER BY created_at DESC LIMIT 1) as last_seal_id
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
    `, [myId]);

    const receivedQuery = await pool.query(`
      SELECT u.handle FROM friendships f 
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
    `, [myId]);

    return NextResponse.json({ 
      friends: friendsQuery.rows, 
      received: receivedQuery.rows 
    });

  } catch (error: any) {
    console.error("Erreur API Friends:", error);
    return NextResponse.json({ error: "Erreur base de données : " + error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { me, target } = await req.json();
    
    // Nettoyage des pseudos
    const myId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me.replace('@', '')])).rows[0]?.id;
    const targetId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [target.replace('@', '')])).rows[0]?.id;
    
    if (!myId || !targetId) return NextResponse.json({ error: 'Utilisateur introuvable dans la base' }, { status: 404 });

    await pool.query(`
      INSERT INTO friendships (requester_id, addressee_id, status) 
      VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING
    `, [myId, targetId]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}
