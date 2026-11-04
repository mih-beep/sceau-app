import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
export async function POST(req: Request) {
  try {
    const { handle, pubkey } = await req.json();
    const result = await pool.query("INSERT INTO users (handle, pubkey) VALUES ($1, decode($2, 'base64')) RETURNING id, handle", [handle, pubkey]);
    return NextResponse.json(result.rows[0]);
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}