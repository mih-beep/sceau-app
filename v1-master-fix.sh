#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. LE PATCH DE CLAUDE (Sécurité Profil Propriétaire vs Public)
# ==========================================================
say "1/6 → Application du patch de Claude (API Profil)"

cat > "src/app/api/profil/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle')?.trim();
  const pubkey = searchParams.get('pubkey')?.trim();

  if (!handle && !pubkey) {
    return NextResponse.json({ error: 'Pseudo ou clé manquant' }, { status: 400 });
  }

  try {
    let isOwner = false;
    let user;
    
    if (pubkey) {
      user = await pool.query(
        "SELECT id, handle, bio, role, is_pro, open_to_collaboration, first_name, last_name, birth_date FROM users WHERE encode(pubkey, 'base64') = $1 LIMIT 1",
        [pubkey]
      );
      isOwner = user.rows.length > 0;
    } else {
      user = await pool.query(
        "SELECT id, handle, bio, role, is_pro, open_to_collaboration, first_name, last_name, birth_date FROM users WHERE LOWER(handle) = LOWER($1) LIMIT 1",
        [handle]
      );
    }
    
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    
    const userId = user.rows[0].id;
    const isPro = user.rows[0].is_pro || false;

    let totalSealed = 0, totalHosted = 0, totalSize = 0;
    try {
      const stats = await pool.query(`SELECT COUNT(id) as total_sealed, SUM(CASE WHEN is_hosted = true THEN 1 ELSE 0 END) as total_hosted, SUM(file_size) as total_size FROM seals WHERE author_id = $1`, [userId]);
      totalSealed = parseInt(stats.rows[0].total_sealed || 0);
      totalHosted = parseInt(stats.rows[0].total_hosted || 0);
      totalSize = parseInt(stats.rows[0].total_size || 0);
    } catch (e: any) { console.warn('Stats error:', e.message); }

    let seals = [];
    try {
      const sealsQuery = await pool.query(`
        SELECT s.id, s.title, s.description, s.timestamp, s.visibility, s.is_flash, s.is_hosted, s.file_path, s.category, encode(s.hash, 'base64') as hash,
        (SELECT COUNT(*) FROM likes WHERE seal_id = s.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE seal_id = s.id) as comments_count
        FROM seals s WHERE s.author_id = $1 ${isOwner ? '' : "AND s.visibility = 'public'"} ORDER BY s.created_at DESC
      `, [userId]);
      seals = sealsQuery.rows;
    } catch (e: any) { console.warn('Seals error:', e.message); }

    let totalPacts = 0;
    try {
      const pacts = await pool.query("SELECT COUNT(*) as total_pacts FROM pact_signatures WHERE user_id = $1", [userId]);
      totalPacts = parseInt(pacts.rows[0].total_pacts || 0);
    } catch (e: any) { console.warn('Pacts error:', e.message); }

    let friendsCount = 0;
    try {
      const friendsRes = await pool.query(`SELECT COUNT(*) as count FROM friendships WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'`, [userId]);
      friendsCount = parseInt(friendsRes.rows[0].count || 0);
    } catch (e: any) { console.warn('Friends error:', e.message); }

    let projects = [];
    try {
      const projectsQuery = !isOwner ? { rows: [] } : await pool.query(`
        SELECT p.id, p.title, p.description, p.merkle_root, p.created_at, p.ots_proof,
               (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count
        FROM projects p WHERE p.author_id = $1 ORDER BY p.created_at DESC
      `, [userId]);
      projects = projectsQuery.rows;
    } catch (e: any) { console.warn('Projects error:', e.message); }

    let favorites = [];
    try {
      const favoritesQuery = !isOwner ? { rows: [] } : await pool.query(`
        SELECT s.id, s.title, s.category, s.timestamp, u.handle as author
        FROM favorites f JOIN seals s ON f.seal_id = s.id JOIN users u ON s.author_id = u.id
        WHERE f.user_id = $1 ORDER BY f.created_at DESC
      `, [userId]);
      favorites = favoritesQuery.rows;
    } catch (e: any) { console.warn('Favorites error:', e.message); }

    let streak = 0;
    try {
      const uniqueDatesSet = new Set(seals.map((s: any) => new Date(s.timestamp).toISOString().split('T')[0]));
      let cursor = new Date();
      cursor.setUTCHours(0, 0, 0, 0);
      if (!uniqueDatesSet.has(cursor.toISOString().split('T')[0])) cursor.setDate(cursor.getDate() - 1);
      while (uniqueDatesSet.has(cursor.toISOString().split('T')[0])) { streak++; cursor.setDate(cursor.getDate() - 1); }
    } catch (e) {}

    const badges = [];
    if (totalSealed >= 1) badges.push({ icon: '🌱', name: 'Apprenti', desc: 'Première œuvre scellée' });
    if (totalSealed >= 10) badges.push({ icon: '🥉', name: 'Archiviste', desc: '10 œuvres scellées' });
    if (totalSealed >= 50) badges.push({ icon: '🥇', name: 'Gardien', desc: '50 œuvres scellées' });
    if (isPro) badges.push({ icon: '👑', name: 'PRO', desc: 'Compte vérifié PRO' });
    if (streak >= 3) badges.push({ icon: '🔥', name: 'En Feu', desc: '3 jours consécutifs' });
    if (totalPacts >= 1) badges.push({ icon: '🤝', name: 'Négociateur', desc: 'A signé un pacte' });

    return NextResponse.json({
      handle: user.rows[0].handle, bio: user.rows[0].bio,
      open_to_collaboration: user.rows[0].open_to_collaboration || false,
      first_name: isOwner ? user.rows[0].first_name : null, 
      last_name: isOwner ? user.rows[0].last_name : null, 
      birth_date: isOwner ? user.rows[0].birth_date : null,
      role: user.rows[0].role, is_pro: isPro, streak: streak, favorites: favorites,
      sealed: totalSealed, hosted: totalHosted, used_bytes: totalSize,
      friends_count: friendsCount, pacts: totalPacts, badges: badges, seals: seals, projects: projects
    });
  } catch (error: any) { 
    console.error("[api/profil]", error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }); 
  }
}
EOF

# ==========================================================
# 2. LE DIFF DE CLAUDE (Page Profil envoie la Pubkey)
# ==========================================================
say "2/6 → Application du diff de Claude (Frontend Profil)"

python3 - << 'PYEOF'
import sys
p = 'src/app/profil/page.tsx'
s = open(p, encoding='utf-8').read()

old_fetch = """      const res = await fetch(
        `/api/profil?handle=${encodeURIComponent(handle.trim())}`,
        { cache: 'no-store' }
      );"""

new_fetch = """      const pubkey = localStorage.getItem('sceau_pubkey');
      const res = await fetch(
        `/api/profil?handle=${encodeURIComponent(handle.trim())}${pubkey ? `&pubkey=${encodeURIComponent(pubkey)}` : ''}`,
        { cache: 'no-store' }
      );"""

if old_fetch in s:
    s = s.replace(old_fetch, new_fetch)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Page Profil mise à jour (envoie la Pubkey)')
else:
    print('  ⚠️ Pattern fetch introuvable (peut-être déjà patché)')
PYEOF

# ==========================================================
# 3. LE FICHIER POSTCSS MANQUANT (Le CSS de Tailwind)
# ==========================================================
say "3/6 → Restauration de postcss.config.mjs (Casse le style sinon)"

cat > postcss.config.mjs << 'EOF'
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
EOF
print('  ✓ postcss.config.mjs restauré')

# ==========================================================
# 4. CORRECTION DU BUG PROJETS (name -> title)
# ==========================================================
say "4/6 → Correction du crash Projets (Arbre de Merkle)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/seal/route.ts'
s = open(p, encoding='utf-8').read()

s = s.replace(
    '"INSERT INTO projects (author_id, name) VALUES ($1, $2) RETURNING id"',
    '"INSERT INTO projects (author_id, title) VALUES ($1, $2) RETURNING id"'
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Bug de colonne corrigé (API Seal -> title)')
PYEOF

# ==========================================================
# 5. CORRECTION UI SCEAU ARCHIVE (statut)
# ==========================================================
say "5/6 → Correction de l'UI SCEAU Archive"

python3 - << 'PYEOF'
import sys
p = 'src/app/archive/page.tsx'
s = open(p, encoding='utf-8').read()

s = s.replace("a.status === 'modified'", "a.last_status === 'modified'")
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Archive corrigée (last_status)')
PYEOF

# ==========================================================
# 6. BUILD FINAL
# ==========================================================
say "6/6 → Nettoyage du cache et build final..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Fusion terminée. La V1 est sécurisée et fonctionnelle !${NC}"
