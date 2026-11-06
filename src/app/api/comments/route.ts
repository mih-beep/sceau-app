import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

// Lire les commentaires d'une œuvre
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sealId = searchParams.get('seal_id');
  if (!sealId) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

  try {
    const result = await pool.query(`
      SELECT c.id, c.content, c.created_at, u.handle as author
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.seal_id = $1 ORDER BY c.created_at ASC
    `, [sealId]);
    return NextResponse.json({ comments: result.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}

// Ajouter un commentaire
export async function POST(req: Request) {
  const { seal_id, pubkey, content } = await req.json();
  if (!seal_id || !pubkey || !content) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id, handle FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const myId = user.rows[0].id;

    await pool.query("INSERT INTO comments (seal_id, user_id, content) VALUES ($1, $2, $3)", [seal_id, myId, content]);

    // Créer une notification pour l'auteur de l'œuvre
    const seal = await pool.query("SELECT author_id, title FROM seals WHERE id = $1", [seal_id]);
    if (seal.rows.length > 0 && seal.rows[0].author_id !== myId) {
      await pool.query(
        "INSERT INTO notifications (user_id, actor_id, type, message, link) VALUES ($1, $2, 'comment', $3, $4)",
        [seal.rows[0].author_id, myId, `a commenté ton œuvre "${seal.rows[0].title}"`, `/o/${seal_id}`]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
