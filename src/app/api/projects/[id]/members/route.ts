import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { pubkey, handle } = await req.json();
    if (!pubkey || !handle) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const project = await pool.query("SELECT author_id FROM projects WHERE id = $1", [id]);
    if (project.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    if (project.rows[0].author_id !== user.rows[0].id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    const target = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [handle.replace('@','')]);
    if (target.rows.length === 0) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    await pool.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [id, target.rows[0].id]);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
