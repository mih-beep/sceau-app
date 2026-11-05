import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
    }

    // On renvoie le handle et la clé publique (convertie en base64)
    return NextResponse.json({
      handle: user.rows[0].handle,
      pubkey: Buffer.from(user.rows[0].pubkey).toString('base64')
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
