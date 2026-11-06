import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

// On force le serveur à ne pas mettre en cache cette route
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const me = searchParams.get('me');
    const search = searchParams.get('search');
    
    if (!me) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

    const myIdRes = await pool.query("SELECT id FROM users WHERE handle = $1", [me]);
    if (myIdRes.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    const myId = myIdRes.rows[0].id;

    // 1. Si on fait une recherche
    if (search) {
      const users = await pool.query(`
        SELECT handle, role FROM users 
        WHERE handle ILIKE $1 AND id != $2 LIMIT 10
      `, [`%${search}%`, myId]);
      return NextResponse.json({ searchResults: users.rows });
    }

    // 2. Récupérer les amis (Requête optimisée)
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

    // 3. Récupérer les demandes en attente
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
    // On renvoie l'erreur exacte pour le débogage, avec un statut 500
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { me, target } = await req.json();
    const meId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0]?.id;
    const targetId = (await pool.query("SELECT id FROM users WHERE handle = $1", [target])).rows[0]?.id;
    
    if (!meId || !targetId) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    await pool.query(`
      INSERT INTO friendships (requester_id, addressee_id, status) 
      VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING
    `, [meId, targetId]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}
