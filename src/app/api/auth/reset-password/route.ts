import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { token, newPassword } = await req.json();
  if (!token || !newPassword) return NextResponse.json({ error: 'Champs requis' }, { status: 400 });

  const user = await pool.query("SELECT id FROM users WHERE reset_token = $1 AND reset_expiry > NOW()", [token]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 400 });

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(newPassword, salt);

  await pool.query("UPDATE users SET password_hash = $1, reset_token = NULL, reset_expiry = NULL WHERE id = $2", [password_hash, user.rows[0].id]);

  return NextResponse.json({ success: true });
}
