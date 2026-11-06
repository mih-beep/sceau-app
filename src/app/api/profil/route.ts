import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id, handle, bio, role, is_pro FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    const userId = user.rows[0].id;
    const isPro = user.rows[0].is_pro || false;

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

    // --- CALCUL DU STREAK ---
    const dates = seals.rows.map((s: any) => new Date(s.timestamp).toISOString().split('T')[0]);
    const uniqueDates = [...new Set(dates)].sort().reverse();
    let streak = 0;
    let currentDate = new Date();
    
    for (let i = 0; i < uniqueDates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(currentDate.getDate() - i);
      const expectedStr = expectedDate.toISOString().split('T')[0];
      
      if (uniqueDates.includes(expectedStr)) {
        streak++;
      } else if (i === 0) {
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (uniqueDates.includes(yesterdayStr)) continue;
        else break;
      } else {
        break;
      }
    }

    // --- FAVORIS ---
    const favorites = await pool.query(`
      SELECT s.id, s.title, s.category, s.timestamp, u.handle as author
      FROM favorites f JOIN seals s ON f.seal_id = s.id JOIN users u ON s.author_id = u.id
      WHERE f.user_id = $1 ORDER BY f.created_at DESC
    `, [userId]);

    // --- BADGES ---
    const badges = [];
    if (totalSealed >= 1) badges.push({ icon: '🌱', name: 'Apprenti', desc: 'Première œuvre scellée' });
    if (totalSealed >= 10) badges.push({ icon: '🥉', name: 'Archiviste', desc: '10 œuvres scellées' });
    if (totalSealed >= 50) badges.push({ icon: '🥇', name: 'Gardien', desc: '50 œuvres scellées' });
    if (isPro) badges.push({ icon: '👑', name: 'PRO', desc: 'Compte vérifié PRO' });
    if (streak >= 3) badges.push({ icon: '🔥', name: 'En Feu', desc: '3 jours consécutifs' });
    if (totalPacts >= 1) badges.push({ icon: '🤝', name: 'Négociateur', desc: 'A signé un pacte' });

    return NextResponse.json({
      handle: user.rows[0].handle,
      bio: user.rows[0].bio,
      role: user.rows[0].role,
      is_pro: isPro,
      streak: streak,
      favorites: favorites.rows,
      sealed: totalSealed,
      hosted: parseInt(stats.rows[0].total_hosted || 0),
      pacts: totalPacts,
      badges: badges,
      seals: seals.rows
    });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
