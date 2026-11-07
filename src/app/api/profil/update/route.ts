import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { pubkey, old_handle, new_handle, bio, role, open_to_collaboration } = await req.json();

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const userId = user.rows[0].id;

    if (new_handle && new_handle !== old_handle) {
      const check = await pool.query("SELECT id FROM users WHERE handle = $1", [new_handle]);
      if (check.rows.length > 0) return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 409 });
    }

    const finalHandle = new_handle || old_handle;
    await pool.query(
      "UPDATE users SET handle = $1, bio = $2, role = $3, open_to_collaboration = $4 WHERE id = $5",
      [finalHandle, bio, role, open_to_collaboration === true, userId]
    );

    return NextResponse.json({ success: true, new_handle: finalHandle });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
