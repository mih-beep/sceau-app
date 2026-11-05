import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    // Pour le MVP, on récupère la liste de tous les autres utilisateurs
    const users = await pool.query("SELECT handle, id FROM users LIMIT 10");
    return NextResponse.json({ contacts: users.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
