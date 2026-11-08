import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const me = searchParams.get('me');
  
  try {
    if (!me) {
      const users = await pool.query("SELECT id, handle FROM users ORDER BY handle ASC");
      return NextResponse.json({ contacts: users.rows });
    }

    const myId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me])).rows[0]?.id;
    if (!myId) return NextResponse.json({ contacts: [] });

    // On renvoie tous les utilisateurs, avec un flag pour savoir si on a déjà discuté
    const users = await pool.query(`
      SELECT u.id, u.handle,
      (SELECT COUNT(*) FROM messages m WHERE (m.sender_id = u.id AND m.receiver_id = $1) OR (m.sender_id = $1 AND m.receiver_id = u.id)) > 0 as has_chat
      FROM users u 
      WHERE u.id != $1
      ORDER BY has_chat DESC, u.handle ASC
    `, [myId]);

    return NextResponse.json({ contacts: users.rows });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { sender_handle, receiver_handle, content } = await req.json();
    if (!sender_handle || !receiver_handle || !content) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const sender = await pool.query("SELECT id FROM users WHERE handle = $1", [sender_handle]);
    const receiver = await pool.query("SELECT id FROM users WHERE handle = $1", [receiver_handle]);
    
    if (sender.rows.length === 0 || receiver.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 404 });
    }

    await pool.query(
      "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)",
      [sender.rows[0].id, receiver.rows[0].id, content]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}
