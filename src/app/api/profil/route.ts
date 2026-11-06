import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id, handle, bio, role FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    const userId = user.rows[0].id;

    const stats = await pool.query(`
      SELECT COUNT(id) as total_sealed, SUM(CASE WHEN is_hosted = true THEN 1 ELSE 0 END) as total_hosted
      FROM seals WHERE author_id = $1
    `, [userId]);

    const seals = await pool.query(`
      SELECT s.id, s.title, s.description, s.timestamp, s.visibility, s.is_flash, s.is_hosted, s.file_path, s.category, encode(s.hash, 'base64') as hash,
      (SELECT COUNT(*) FROM likes WHERE seal_id = s.id) as likes_count,
      (SELECT COUNT(*) FROM comments WHERE seal_id = s.id) as comments_count
      FROM seals s WHERE s.author_id = $1 ORDER BY s.created_at DESC
    `, [userId]);

    const pacts = await pool.query("SELECT COUNT(*) as total_pacts FROM pact_signatures WHERE user_id = $1", [userId]);

    const totalSealed = parseInt(stats.rows[0].total_sealed || 0);
    const totalPacts = parseInt(pacts.rows[0].total_pacts || 0);

    const badges = [];
    if (totalSealed >= 1) badges.push({ icon: '🌱', name: 'Apprenti', desc: 'Première œuvre scellée' });
    if (totalSealed >= 10) badges.push({ icon: '🥉', name: 'Archiviste', desc: '10 œuvres scellées' });
    if (totalSealed >= 50) badges.push({ icon: '🥇', name: 'Gardien', desc: '50 œuvres scellées' });
    if (totalSealed >= 100) badges.push({ icon: '🏆', name: 'Légende', desc: '100 œuvres scellées' });
    if (totalPacts >= 1) badges.push({ icon: '🤝', name: 'Négociateur', desc: 'A signé un pacte' });

    return NextResponse.json({
      handle: user.rows[0].handle,
      bio: user.rows[0].bio,
      role: user.rows[0].role,
      sealed: totalSealed,
      hosted: parseInt(stats.rows[0].total_hosted || 0),
      pacts: totalPacts,
      badges: badges,
      seals: seals.rows
    });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
