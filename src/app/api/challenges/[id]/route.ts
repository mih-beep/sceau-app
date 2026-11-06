import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const challenge = await pool.query("SELECT * FROM challenges WHERE id = $1", [id]);
    if (challenge.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const entries = await pool.query(`
      SELECT e.id as entry_id, s.id as seal_id, s.title, s.description, s.file_path, s.category, 
      CASE WHEN $2 = true THEN 'Anonyme' ELSE u.handle END as author,
      (SELECT COUNT(*) FROM challenge_votes WHERE entry_id = e.id) as votes
      FROM challenge_entries e
      JOIN seals s ON e.seal_id = s.id
      JOIN users u ON e.user_id = u.id
      WHERE e.challenge_id = $1
      ORDER BY votes DESC
    `, [id, challenge.rows[0].is_anonymous]);

    return NextResponse.json({ challenge: challenge.rows[0], entries: entries.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
