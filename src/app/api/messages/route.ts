import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

// GET pour la liste des contacts
export async function GET(req: Request) {
  try {
    const users = await pool.query("SELECT id, handle FROM users ORDER BY handle ASC");
    return NextResponse.json({ contacts: users.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}

// POST pour envoyer un message
export async function POST(req: Request) {
  try {
    const { sender_handle, receiver_handle, content } = await req.json();
    
    const sender = await pool.query("SELECT id FROM users WHERE handle = $1", [sender_handle]);
    const receiver = await pool.query("SELECT id FROM users WHERE handle = $1", [receiver_handle]);
    
    if (sender.rows.length === 0 || receiver.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 404 });

    await pool.query(
      "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)",
      [sender.rows[0].id, receiver.rows[0].id, content]
    );
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
