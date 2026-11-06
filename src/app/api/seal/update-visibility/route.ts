import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { seal_id, pubkey, visibility } = await req.json();

    if (!seal_id || !pubkey || !visibility) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    // Vérifier que l'utilisateur est bien le propriétaire
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const seal = await pool.query("SELECT author_id FROM seals WHERE id = $1", [seal_id]);
    if (seal.rows.length === 0) return NextResponse.json({ error: 'Sceau introuvable' }, { status: 404 });
    
    if (seal.rows[0].author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Mettre à jour la visibilité (et is_public pour la compatibilité)
    const isPublic = visibility === 'public';
    await pool.query(
      "UPDATE seals SET visibility = $1, is_public = $2 WHERE id = $3",
      [visibility, isPublic, seal_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
