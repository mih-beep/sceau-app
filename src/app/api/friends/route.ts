import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const me = searchParams.get('me');
  if (!me) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  try {
    const myIdRes = await pool.query("SELECT id FROM users WHERE handle = $1", [me]);
    if (myIdRes.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    const myId = myIdRes.rows[0].id;

    // 1. Mes amis acceptés
    const friends = await pool.query(`
      SELECT u.id, u.handle FROM friendships f
      JOIN users u ON (u.id = f.requester_id OR u.id = f.addressee_id)
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted' AND u.id != $1
    `, [myId]);

    // 2. Demandes reçues en attente
    const received = await pool.query(`
      SELECT u.handle FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
    `, [myId]);

    // 3. Demandes envoyées
    const sent = await pool.query(`
      SELECT u.handle FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = $1 AND f.status = 'pending'
    `, [myId]);

    return NextResponse.json({ friends: friends.rows, received: received.rows, sent: sent.rows });
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
