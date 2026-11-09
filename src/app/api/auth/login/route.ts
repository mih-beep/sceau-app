import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import bcrypt from 'bcryptjs';

const loginCache = new Map<string, { count: number, resetAt: number }>();

function checkLimit(ip: string) {
  const now = Date.now();
  let e = loginCache.get(ip);
  if (!e || e.resetAt < now) { e = { count: 0, resetAt: now + 60000 }; loginCache.set(ip, e); }
  if (e.count >= 5) return false;
  e.count++;
  return true;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkLimit(ip)) return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 1 minute.' }, { status: 429 });

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
