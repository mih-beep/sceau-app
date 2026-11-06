import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const title = data.get('title') as string;
    const description = data.get('description') as string;
    const pubkey = data.get('pubkey') as string;
    const groupId = data.get('group_id') as string; // NOUVEAU
    const requiredSignatures = parseInt(data.get('required_signatures') as string || '2'); // NOUVEAU

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const creatorId = user.rows[0].id;

    const pact = await pool.query(
      "INSERT INTO pacts (title, description, creator_id, group_id, required_signatures) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [title, description, creatorId, groupId || null, requiredSignatures]
    );
    
    // Le créateur signe automatiquement
    await pool.query("INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2)", [pact.rows[0].id, creatorId]);
    
    return NextResponse.json({ id: pact.rows[0].id, title });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
