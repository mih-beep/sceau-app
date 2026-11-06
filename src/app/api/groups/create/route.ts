import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { name, creator_pubkey } = await req.json();
  try {
    const creator = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [creator_pubkey]);
    if (creator.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const creatorId = creator.rows[0].id;

    const group = await pool.query(
      "INSERT INTO groups (name, creator_id) VALUES ($1, $2) RETURNING id",
      [name, creatorId]
    );
    const groupId = group.rows[0].id;

    // Le créateur est automatiquement membre
    await pool.query("INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)", [groupId, creatorId]);
    
    return NextResponse.json({ group_id: groupId });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
