import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pubkey, targetHandle } = await req.json();

  try {
    const me = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (me.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    
    const target = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [targetHandle.replace('@', '')]);
    if (target.rows.length === 0) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    // Vérifier que celui qui invite est bien dans le groupe
    const isMember = await pool.query("SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2", [id, me.rows[0].id]);
    if (isMember.rows.length === 0) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [id, target.rows[0].id]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
