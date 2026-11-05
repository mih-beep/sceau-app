import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { handle, email, password, pubkey } = await req.json();

    if (!handle || !email || !password || !pubkey) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 });
    }

    // On crypte le mot de passe (on ne le stocke jamais en clair)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      "INSERT INTO users (handle, email, password_hash, pubkey) VALUES ($1, $2, $3, decode($4, 'base64')) RETURNING id, handle", 
      [handle, email, password_hash, pubkey]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ce pseudo ou cet email est déjà pris' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
