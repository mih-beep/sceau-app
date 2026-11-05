import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { handle, pubkey } = await req.json();

    // 1. Vérification des données
    if (!handle || !pubkey) {
      return NextResponse.json({ error: 'Pseudo et clé requis' }, { status: 400 });
    }

    // 2. Insertion
    const result = await pool.query(
      "INSERT INTO users (handle, pubkey) VALUES ($1, decode($2, 'base64')) RETURNING id, handle", 
      [handle, pubkey]
    );
    
    return NextResponse.json(result.rows[0]);

  } catch (error: any) {
    // Si le pseudo existe déjà (Code PostgreSQL 23505 = violation d'unicité)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur lors de l\'inscription' }, { status: 500 });
  }
}
