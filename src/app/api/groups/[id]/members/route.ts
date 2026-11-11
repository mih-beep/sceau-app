import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

// GET : Lister les membres d'un groupe
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await pool.query(`
      SELECT u.handle, u.role, u.id as user_id
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
      ORDER BY gm.created_at ASC
    `, [id]);
    return NextResponse.json({ members: res.rows });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// POST : Ajouter un membre
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

// DELETE : Retirer un membre
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  const targetHandle = searchParams.get('target');

  if (!pubkey || !targetHandle) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const me = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (me.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const target = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [targetHandle.replace('@', '')]);
    if (target.rows.length === 0) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    // On ne peut pas se retirer soi-même si on est le créateur (simplification)
    if (target.rows[0].id === me.rows[0].id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous retirer vous-même (utilisez "Quitter")' }, { status: 400 });
    }

    await pool.query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [id, target.rows[0].id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
