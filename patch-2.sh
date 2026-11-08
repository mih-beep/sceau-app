#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# A. Sécuriser /api/seal/[id]/ots/refresh (auth propriétaire)
# ==========================================================
say "A/2 → src/app/api/seal/[id]/ots/refresh/route.ts"

cat > "src/app/api/seal/[id]/ots/refresh/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { upgradeOts } from '@/lib/ots';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');

  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

  try {
    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const res = await pool.query(
      "SELECT author_id, hash, ots_proof FROM seals WHERE id = $1",
      [id]
    );
    if (res.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const row = res.rows[0];
    if (row.author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    if (!row.ots_proof) {
      return NextResponse.json({ status: 'no_proof', message: 'Aucune preuve .ots stockée.' });
    }

    const upgraded = await upgradeOts(new Uint8Array(row.hash), row.ots_proof);
    if (!upgraded) {
      return NextResponse.json({ status: 'pending', message: 'Pas encore confirmé. Réessaie dans quelques heures.' });
    }

    await pool.query(
      "UPDATE seals SET ots_proof = $1, ots_upgraded_at = NOW() WHERE id = $2",
      [upgraded.toString('base64'), id]
    );
    return NextResponse.json({ status: 'upgraded', size: upgraded.length });
  } catch (e) {
    return apiError(e, 'Erreur lors de la mise à jour de la preuve');
  }
}
EOF

# ==========================================================
# B. Profil — bouton + modale "Preuves techniques"
# ==========================================================
say "B/2 → src/app/profil/page.tsx (modale preuves techniques)"

python3 - << 'PYEOF'
p = 'src/app/profil/page.tsx'
s = open(p, encoding='utf-8').read()

# B.1 — states
old = """  const [accessLogSealId, setAccessLogSealId] = useState<string | null>(null);
  const [showAccessLogList, setShowAccessLogList] = useState(false);"""
new = """  const [accessLogSealId, setAccessLogSealId] = useState<string | null>(null);
  const [showAccessLogList, setShowAccessLogList] = useState(false);
  const [showTechProofs, setShowTechProofs] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);"""
if old not in s: raise SystemExit('  ✗ states introuvables')
s = s.replace(old, new, 1)

# B.2 — fonctions openTechProofs + refreshOts
old = """  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;"""
new = """  function openTechProofs() {
    if (activeTab === 'favorites') setActiveTab('public');
    setShowTechProofs(true);
  }

  async function refreshOts(sealId: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert('Connecte-toi.');
    setRefreshingId(sealId);
    try {
      const res = await fetch(`/api/seal/${sealId}/ots/refresh?pubkey=${encodeURIComponent(pubkey)}`, { method: 'POST' });
      const d = await res.json();
      if (d.status === 'upgraded') {
        alert('✅ Preuve mise à jour avec confirmation Bitcoin');
        await loadProfil();
      } else if (d.status === 'pending') {
        alert('⏳ Pas encore confirmé. Réessaie dans quelques heures.');
      } else if (d.status === 'no_proof') {
        alert('❌ Aucune preuve .ots enregistrée pour ce sceau.');
      } else {
        alert('❌ ' + (d.error || 'Erreur inconnue'));
      }
    } catch {
      alert('❌ Impossible de contacter le serveur.');
    } finally {
      setRefreshingId(null);
    }
  }

  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;"""
if old not in s: raise SystemExit('  ✗ guard introuvable')
s = s.replace(old, new, 1)

# B.3 — bouton dans la branche favorites
old = """        <button onClick={() => setActiveTab('public')} className="text-sm font-bold text-[#A89070] mb-4 hover:underline">← Retour au coffre</button>
        <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📌 Mes Favoris</h2>"""
new = """        <button onClick={() => setActiveTab('public')} className="text-sm font-bold text-[#A89070] mb-4 hover:underline">← Retour au coffre</button>
        <button onClick={openTechProofs} className="mb-4 bg-[#FDF8F0] text-[#A88620] border border-[#E9C46A] px-4 py-2 rounded-lg font-bold text-sm shadow-sm">🔬 Preuves techniques</button>
        <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📌 Mes Favoris</h2>"""
if old not in s: raise SystemExit('  ✗ branche favorites introuvable')
s = s.replace(old, new, 1)

# B.4 — 3ème bouton dans la rangée principale
old = """      <div className="flex gap-4 mb-8">
        <button onClick={openPortfolioModal} className="flex-1 bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm shadow-md hover:opacity-80 transition">📄 Exporter mon Portfolio</button>
        <button onClick={() => setShowAccessLogList(true)} className="flex-1 bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] p-3 rounded-xl font-bold text-sm shadow-sm hover:bg-[#E0EDF8] transition">📖 Journal des accès</button>
      </div>"""
new = """      <div className="flex flex-wrap gap-3 mb-8">
        <button onClick={openPortfolioModal} className="flex-1 min-w-[180px] bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm shadow-md hover:opacity-80 transition">📄 Exporter mon Portfolio</button>
        <button onClick={() => setShowAccessLogList(true)} className="flex-1 min-w-[180px] bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] p-3 rounded-xl font-bold text-sm shadow-sm hover:bg-[#E0EDF8] transition">📖 Journal des accès</button>
        <button onClick={openTechProofs} className="flex-1 min-w-[180px] bg-[#FDF8F0] text-[#A88620] border border-[#E9C46A] p-3 rounded-xl font-bold text-sm shadow-sm hover:bg-[#FCEFCB] transition">🔬 Preuves techniques</button>
      </div>"""
if old not in s: raise SystemExit('  ✗ rangée boutons introuvable')
s = s.replace(old, new, 1)

# B.5 — modale preuves techniques
old = """      {/* MODALE DE SÉLECTION DU JOURNAL DES ACCÈS */}
      {showAccessLogList && ("""
new = """      {/* MODALE — PREUVES TECHNIQUES (propriétaire uniquement) */}
      {showTechProofs && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>🔬 Preuves techniques</h2>
              <button onClick={() => setShowTechProofs(false)} className="text-2xl opacity-50">✕</button>
            </div>
            <p className="text-xs text-[var(--text-muted)] italic mb-4">
              Zone technique. Le public ne voit que <strong>Validé / Non validé</strong> sur la page de chaque œuvre.
              Ici tu peux vérifier, télécharger et forcer la confirmation des preuves OpenTimestamps.
            </p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {data.seals.length === 0 && (
                <p className="text-center italic text-[var(--text-muted)] py-10">Aucune œuvre dans ton coffre.</p>
              )}
              {data.seals.map((seal: any) => {
                const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : '';
                const isRefreshing = refreshingId === seal.id;
                return (
                  <div key={seal.id} className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-4">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                        <div className="text-[0.65rem] font-mono text-[var(--text-muted)]">
                          Scellé le {new Date(seal.timestamp).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      {seal.ots_upgraded_at ? (
                        <span className="shrink-0 bg-[#F5F9EE] text-[#5D7A3A] border border-[#A8C77E] px-2 py-1 rounded text-[0.65rem] font-bold whitespace-nowrap">
                          ✅ Confirmé {new Date(seal.ots_upgraded_at).toLocaleDateString('fr-FR')}
                        </span>
                      ) : seal.ots_proof ? (
                        <span className="shrink-0 bg-[#FCEAD6] text-[#C44A2E] border border-[#F4D0A8] px-2 py-1 rounded text-[0.65rem] font-bold whitespace-nowrap">
                          ⏳ En attente
                        </span>
                      ) : (
                        <span className="shrink-0 bg-[#F3F3F3] text-[#666] border border-[#DDD] px-2 py-1 rounded text-[0.65rem] font-bold whitespace-nowrap">
                          🔒 Pas d'ancrage
                        </span>
                      )}
                    </div>

                    {seal.hash_hex && (
                      <div className="mb-3">
                        <div className="text-[0.6rem] font-mono text-[var(--text-muted)] mb-1 uppercase">SHA-256 (hex)</div>
                        <div className="bg-white border border-[var(--border-color)] rounded p-2 font-mono text-[0.6rem] break-all leading-relaxed">
                          {seal.hash_hex}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {seal.ots_proof ? (
                        <>
                          <a
                            href={`/api/seal/${seal.id}/ots?pubkey=${encodeURIComponent(pubkey || '')}`}
                            download
                            className="bg-[#5D7A3A] text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            ⬇️ Télécharger .ots
                          </a>
                          <button
                            onClick={() => refreshOts(seal.id)}
                            disabled={isRefreshing || !!seal.ots_upgraded_at}
                            className="bg-white border-2 border-[#7A9B5A] text-[#5D7A3A] px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                          >
                            {isRefreshing ? '⏳...' : seal.ots_upgraded_at ? '✅ Confirmé' : '🔄 Vérifier confirmation'}
                          </button>
                          <a
                            href="https://opentimestamps.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white border border-[var(--border-color)] text-[var(--text-main)] px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            🔍 Vérifier en ligne
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)] italic">
                          Aucune preuve .ots enregistrée (l'ancrage a échoué au scellage).
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE SÉLECTION DU JOURNAL DES ACCÈS */}
      {showAccessLogList && ("""
if old not in s: raise SystemExit('  ✗ fin de composant introuvable')
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ profil/page.tsx : bouton + modale + refresh auth')
PYEOF

echo ""
echo -e "${GREEN}✅ Patch 2/2 appliqué.${NC}"
