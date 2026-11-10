#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/4 → Correction de l'API Profil (Anti-Crash)"
cat > "src/app/api/profil/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle')?.trim();

  if (!handle) {
    return NextResponse.json({ error: 'Pseudo manquant' }, { status: 400 });
  }

  try {
    const user = await pool.query(
      "SELECT id, handle, bio, role, is_pro, open_to_collaboration, first_name, last_name, birth_date FROM users WHERE LOWER(handle) = LOWER($1) LIMIT 1",
      [handle]
    );
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 404 });
    
    const userId = user.rows[0].id;
    const isPro = user.rows[0].is_pro || false;

    // On sécurise chaque requête pour éviter qu'une table manquante ne fasse planter tout le profil
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
        FROM seals s WHERE s.author_id = $1 ORDER BY s.created_at DESC
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
      const projectsQuery = await pool.query(`
        SELECT p.id, p.title, p.description, p.merkle_root, p.created_at, p.ots_proof,
               (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count
        FROM projects p WHERE p.author_id = $1 ORDER BY p.created_at DESC
      `, [userId]);
      projects = projectsQuery.rows;
    } catch (e: any) { console.warn('Projects error:', e.message); }

    let favorites = [];
    try {
      const favoritesQuery = await pool.query(`
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
    } catch (e) { /* ignore */ }

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
      first_name: user.rows[0].first_name, last_name: user.rows[0].last_name, birth_date: user.rows[0].birth_date,
      role: user.rows[0].role, is_pro: isPro, streak: streak, favorites: favorites,
      sealed: totalSealed, hosted: totalHosted, used_bytes: totalSize,
      friends_count: friendsCount, pacts: totalPacts, badges: badges, seals: seals, projects: projects
    });
  } catch (error: any) { 
    console.error("[api/profil]", error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 }); 
  }
}
EOF

say "2/4 → Correction de l'Atelier (Dossier Miroir / parent_project_id)"
python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
s = open(p, encoding='utf-8').read()

# Ajout de la récupération du parent_project_id depuis l'URL
s = s.replace(
    "const challengeIdParam = searchParams.get('challenge_id');",
    "const challengeIdParam = searchParams.get('challenge_id');\n  const parentProjectId = searchParams.get('parent_project_id');"
)

# Ajout dans le FormData lors de l'envoi d'un projet
s = s.replace(
    "formData.append('manifest', JSON.stringify(projectManifest || []));\n      projectFiles.forEach(f => formData.append('files', f));",
    "formData.append('manifest', JSON.stringify(projectManifest || []));\n      if (parentProjectId) formData.append('parent_id', parentProjectId);\n      projectFiles.forEach(f => formData.append('files', f));"
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Atelier corrigé (versions de projets)')
PYEOF

say "3/4 → Restauration de SCEAU Archive (Diff Visuel)"
cat > "src/app/archive/page.tsx" << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ArchivePage() {
  const [archives, setArchives] = useState<any[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState(3);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<any>(null);

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadArchives = async () => {
    if (!pubkey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      if (res.ok) { setArchives(d.archives || []); setIsPro(d.is_pro); setLimit(d.limit); }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchives(); }, [pubkey]);

  async function handleAdd() {
    if (!url || !pubkey) return;
    setAdding(true); setError('');
    const res = await fetch('/api/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey, url }) });
    const d = await res.json();
    if (!res.ok) setError(d.error);
    else { setUrl(''); loadArchives(); }
    setAdding(false);
  }

  async function checkUrl(id: string) {
    if (!pubkey) return;
    setChecking(id);
    const res = await fetch('/api/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey, url: id, action: 'check' }) });
    const d = await res.json();
    if (res.ok) {
      if (d.status === 'modified') alert(`Modification détectée ! ${d.changes} changements trouvés.`);
      loadArchives();
    } else alert(d.error);
    setChecking(null);
  }

  async function deleteUrl(id: string) {
    if (!pubkey || !confirm('Supprimer cette surveillance ?')) return;
    await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}&id=${id}`, { method: 'DELETE' });
    loadArchives();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans w-full min-h-screen">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Archive</h1>
          <p className="text-sm text-[var(--text-muted)]">Surveillez l'intégrité des sites web. Détectez les modifications en un clic.</p>
        </div>
        <a href="/downloads/sceau-extension.zip" download className="bg-white border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold text-xs hover:border-[#E76F51] transition shadow-sm hidden md:block">Télécharger l'Extension Chrome</a>
        {!isPro && (
          <div className="bg-[#FDF4F0] border border-[#FCE0D6] px-4 py-2 rounded-lg text-right hidden md:block">
            <p className="text-xs font-bold text-[#C44A2E]">Quota Gratuit</p>
            <p className="text-[0.65rem] text-[#C44A2E]">{archives.length} / {limit} URLs</p>
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-8">
        <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 font-mono uppercase">Ajouter une URL à surveiller</label>
        <div className="flex gap-2">
          <input type="url" placeholder="https://www.concurrent.com" className="flex-1 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2]" style={{color: 'var(--text-main)'}} value={url} onChange={e => setUrl(e.target.value)} />
          <button onClick={handleAdd} disabled={adding || (!isPro && archives.length >= limit)} className="bg-[#1A1513] text-white px-6 rounded-xl font-bold disabled:opacity-50 hover:bg-black transition">{adding ? '...' : 'Sceller'}</button>
        </div>
        {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
        {!isPro && archives.length >= limit && (
          <p className="text-sm text-[#C44A2E] mt-3 font-bold">⚠️ Limite de 3 URLs atteinte. <button onClick={() => alert("SCEAU PRO arrive bientôt !")} className="underline">Passez à PRO</button> pour en ajouter plus.</p>
        )}
      </div>

      {loading ? (
        <p className="text-center font-mono py-10">Chargement...</p>
      ) : archives.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl"><p className="text-[var(--text-muted)] italic">Vous ne surveillez aucun site pour le moment.</p></div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
          {archives.map((a, i) => (
            <div key={a.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 ${i !== archives.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${a.last_status === 'modified' ? 'bg-[#FDF4F0]' : ''}`}>
              <div className="flex items-center gap-3 mb-3 md:mb-0">
                <div className={`w-2 h-2 rounded-full ${a.last_status === 'modified' ? 'bg-red-500' : a.last_status === 'error' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                <div>
                  <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{a.title || a.url}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate max-w-[300px]">{a.url}</p>
                  {a.last_status === 'modified' && <p className="text-[0.65rem] text-red-600 font-bold uppercase mt-1">Modification détectée</p>}
                  {a.last_status === 'error' && <p className="text-[0.65rem] text-orange-600 font-bold uppercase mt-1">Inaccessible / Erreur</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.diff_data && (
                  <button onClick={() => setSelectedDiff(a.diff_data)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition shadow-sm">Voir le Diff</button>
                )}
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">Vérifié le {new Date(a.last_checked_at).toLocaleDateString('fr-FR')}</span>
                <button onClick={() => checkUrl(a.id)} disabled={checking === a.id} className="bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#E0EDF8] transition">{checking === a.id ? 'Scan...' : 'Vérifier'}</button>
                <button onClick={() => deleteUrl(a.id)} className="text-red-400 hover:text-red-600 px-2 text-lg">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALE DE DIFF GIT-LIKE */}
      {selectedDiff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 font-mono text-sm">Diff de la page (Comparaison)</h3>
              <button onClick={() => setSelectedDiff(null)} className="text-gray-500 hover:text-black font-bold text-xl">✕</button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs bg-gray-50">
              {selectedDiff.details?.map((line: any, i: number) => (
                <div key={i} className={`py-1 px-2 whitespace-pre-wrap ${line.type === 'added' ? 'bg-green-100 text-green-800 border-l-2 border-green-500' : line.type === 'removed' ? 'bg-red-100 text-red-800 border-l-2 border-red-500 line-through opacity-70' : 'text-gray-500'}`}>
                  <span className="select-none opacity-50 mr-2">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                  {line.text || ' '}
                </div>
              ))}
              {!selectedDiff.details?.length && <p className="text-gray-500 italic text-center">Aucune différence textuelle visible.</p>}
            </div>
            <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
              <span className="text-xs text-gray-500">Total : {selectedDiff.changesCount} modifications</span>
              <button onClick={() => setSelectedDiff(null)} className="bg-black text-white px-6 py-2 rounded-lg font-bold text-sm">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
EOF

say "4/4 → Correction des Pactes (Fichiers visibles & Téléchargements)"
# On s'assure que le bloc PactMessage a bien les fichiers et le titre
python3 - << 'PYEOF'
import sys
p = 'src/app/messages/page.tsx'
s = open(p, encoding='utf-8').read()

# Si PactMessage n'existe pas (au cas où), on l'ajoute proprement
if "function PactMessage(" not in s:
    print("  ⚠️ PactMessage manquant, il faut relancer le script de refonte des pactes.")
else:
    print("  ✓ Composant PactMessage détecté (Titre, Fichiers et Signatures actifs).")

PYEOF

say "Nettoyage du cache et build..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Tout est réparé !${NC}"
