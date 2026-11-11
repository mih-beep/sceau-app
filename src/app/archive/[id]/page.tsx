'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ArchiveDetail() {
  const params = useParams();
  const router = useRouter();
  const [site, setSite] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showAllChanges, setShowAllChanges] = useState(false);

  const loadArchive = async () => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.replace('/login'); return; }

    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      const found = (d.archives || []).find((s: any) => s.main_id === params.id || s.pages.some((p: any) => p.id === params.id));
      if (found) {
        setSite(found);
        const page = found.pages.find((p: any) => p.id === params.id) || found.pages.find((p: any) => p.url === found.main_url) || found.pages[0];
        setCurrentPage(page);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchive(); }, [params.id]);

  async function runCheck() {
    if (!currentPage) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;

    setChecking(true);
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url: currentPage.id, action: 'check' })
    });
    await res.json();
    await loadArchive();
    setChecking(false);
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!site || !currentPage) return <div className="p-10 text-center">Archive introuvable.</div>;

  const isModified = currentPage.last_status === 'modified';
  const isError = currentPage.last_status === 'error';
  const diffDetails = currentPage.diff_data?.details || [];
  const changesCount = currentPage.diff_data?.changesCount || 0;
  const visibleChanges = showAllChanges ? diffDetails : diffDetails.slice(0, 20);
  const otherPages = site.pages.filter((p: any) => p.id !== currentPage.id);

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-3xl mx-auto font-sans w-full min-h-screen">
      
      {/* Bouton retour */}
      <button onClick={() => router.push('/archive')} className="text-sm font-bold mb-4 flex items-center gap-2 opacity-60 hover:opacity-100" style={{color: 'var(--text-main)'}}>
        ← Retour à Archive
      </button>

      {/* ========== HEADER COMPACT ========== */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex justify-between items-start gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold font-serif break-words leading-tight" style={{color: 'var(--text-main)'}}>
              {site.main_title}
            </h1>
            <a href={site.site_root} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4A90C2] hover:underline break-all">
              {site.site_root}
            </a>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-[0.7rem] font-bold shrink-0 whitespace-nowrap ${
            isError ? 'bg-orange-50 text-orange-700 border border-orange-200' :
            isModified ? 'bg-[#FDF4F0] text-[#C44A2E] border border-[#FCE0D6]' : 
            'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {isError ? '🔒 Inaccessible' : isModified ? '⚠️ Modifié' : '✅ Intact'}
          </div>
        </div>
        
        {/* Timestamp discret */}
        <p className="text-[0.7rem] font-mono text-[var(--text-muted)]">
          Dernière vérification : {new Date(currentPage.last_checked_at).toLocaleString('fr-FR')}
        </p>
      </div>

      {/* ========== SI MODIFIÉ : LE DIFF AU CENTRE ========== */}
      {isModified && (
        <>
          {/* Message d'alerte */}
          <div className="bg-[#FDF4F0] border-2 border-[#FCE0D6] rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🚨</span>
              <h2 className="font-bold text-[#C44A2E]" style={{fontSize: '1.05rem'}}>
                {changesCount} changement{changesCount > 1 ? 's' : ''} détecté{changesCount > 1 ? 's' : ''}
              </h2>
            </div>
            <p className="text-xs text-[#C44A2E] italic">
              Ce contenu a été modifié depuis votre dernière capture.
            </p>
          </div>

          {/* Analyse de l'IA (si disponible) */}
          {currentPage.ai_summary && (
            <div className="bg-[#F0F6FC] border-l-4 border-[#4A90C2] rounded-r-xl p-4 mb-4">
              <h3 className="text-[0.7rem] font-bold text-[#2D6A9E] uppercase tracking-wider mb-2">
                🧠 Analyse de l'IA
              </h3>
              <p className="text-sm italic text-[var(--text-main)]">
                {currentPage.ai_summary}
              </p>
            </div>
          )}

          {/* LE DIFF COLORÉ (Le cœur de la page) */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm mb-4">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="font-bold text-sm" style={{color: 'var(--text-main)'}}>
                🔍 Ce qui a changé
              </h3>
              <span className="text-[0.65rem] font-mono text-[var(--text-muted)]">
                {showAllChanges ? diffDetails.length : Math.min(20, diffDetails.length)} / {diffDetails.length} lignes
              </span>
            </div>
            
            <div className="p-4 font-mono text-xs bg-[var(--bg-main)] max-h-[500px] overflow-y-auto">
              {visibleChanges.map((line: any, i: number) => (
                <div key={i} className={`py-1.5 px-2 mb-1 rounded whitespace-pre-wrap break-words ${
                  line.type === 'added' ? 'bg-green-50 text-green-800 border-l-2 border-green-500' :
                  line.type === 'removed' ? 'bg-red-50 text-red-800 border-l-2 border-red-500 line-through opacity-80' :
                  'text-[var(--text-muted)]'
                }`}>
                  <span className="opacity-50 mr-2 font-bold">{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span>
                  {line.text || ' '}
                </div>
              ))}
            </div>

            {diffDetails.length > 20 && (
              <div className="p-3 border-t border-[var(--border-color)] text-center">
                <button 
                  onClick={() => setShowAllChanges(!showAllChanges)}
                  className="text-xs font-bold text-[#4A90C2] hover:underline"
                >
                  {showAllChanges ? '↑ Voir moins' : `↓ Voir les ${diffDetails.length - 20} autres changements`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== SI INTACT ========== */}
      {!isModified && !isError && (
        <div className="bg-[#F0FAF4] border-2 border-[#A8C77E] rounded-2xl p-6 mb-4 text-center">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="font-bold text-[#3F8F5C] mb-2">Aucun changement détecté</h2>
          <p className="text-sm text-[#5D7A3A]">
            Le contenu de cette page est identique à la dernière vérification.
            SCEAU surveille en continu et vous alertera au moindre changement.
          </p>
        </div>
      )}

      {/* ========== SI ERREUR ========== */}
      {isError && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 mb-4 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h2 className="font-bold text-orange-700 mb-2">Site inaccessible</h2>
          <p className="text-sm text-orange-600">
            Le dernier scan a échoué (site temporairement indisponible ou bloquant).
            SCEAU réessaiera automatiquement.
          </p>
        </div>
      )}

      {/* ========== ACTIONS ========== */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex-1 min-w-[180px] bg-[#1A1513] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition disabled:opacity-50"
        >
          {checking ? '⏳ Vérification...' : '🔄 Vérifier maintenant'}
        </button>
        <a
          href={currentPage.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[180px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] py-3 rounded-xl font-bold text-sm text-center hover:border-[#E76F51] transition"
        >
          🌐 Visiter la page
        </a>
      </div>

      {/* ========== AUTRES PAGES (Discret) ========== */}
      {otherPages.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl mb-4 overflow-hidden">
          <button 
            onClick={() => setShowAllPages(!showAllPages)}
            className="w-full p-4 flex justify-between items-center hover:bg-[var(--bg-main)] transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="font-bold text-sm" style={{color: 'var(--text-main)'}}>
                Autres pages surveillées ({otherPages.length})
              </span>
            </div>
            <span className="text-[var(--text-muted)] text-sm">{showAllPages ? '▲' : '▼'}</span>
          </button>
          
          {showAllPages && (
            <div className="border-t border-[var(--border-color)] max-h-80 overflow-y-auto">
              {otherPages.map((p: any) => (
                <Link 
                  key={p.id} 
                  href={`/archive/${p.id}`}
                  className="flex justify-between items-center p-3 hover:bg-[var(--bg-main)] border-b border-[var(--border-color)] last:border-0 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{color: 'var(--text-main)'}}>{p.title}</p>
                    <p className="text-[0.65rem] font-mono text-[var(--text-muted)] truncate">{p.url}</p>
                  </div>
                  <span className={`shrink-0 ml-2 text-[0.65rem] px-2 py-0.5 rounded font-bold ${
                    p.last_status === 'modified' ? 'bg-[#FDF4F0] text-[#C44A2E]' : 
                    p.last_status === 'error' ? 'bg-orange-50 text-orange-700' :
                    'bg-green-50 text-green-700'
                  }`}>
                    {p.last_status === 'modified' ? '⚠️' : p.last_status === 'error' ? '🔒' : '✅'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== DÉTAILS TECHNIQUES (Cachés par défaut) ========== */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
        <button 
          onClick={() => setShowTechDetails(!showTechDetails)}
          className="w-full p-3 flex justify-between items-center hover:bg-[var(--bg-main)] transition"
        >
          <span className="text-[0.7rem] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
            ⚙️ Détails techniques
          </span>
          <span className="text-[var(--text-muted)] text-xs">{showTechDetails ? '▲' : '▼'}</span>
        </button>
        
        {showTechDetails && (
          <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-main)] grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[0.6rem] font-mono uppercase text-[var(--text-muted)] mb-1">Pages suivies</p>
              <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{site.pages_count}</p>
            </div>
            <div>
              <p className="text-[0.6rem] font-mono uppercase text-[var(--text-muted)] mb-1">Scans effectués</p>
              <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{site.scan_count || 1}</p>
            </div>
            <div>
              <p className="text-[0.6rem] font-mono uppercase text-[var(--text-muted)] mb-1">Suivi depuis</p>
              <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>
                {Math.floor((Date.now() - new Date(site.created_at).getTime()) / 86400000)} jour(s)
              </p>
            </div>
            <div>
              <p className="text-[0.6rem] font-mono uppercase text-[var(--text-muted)] mb-1">Statut du site</p>
              <p className={`font-bold text-sm ${site.has_modifications ? 'text-[#C44A2E]' : 'text-[#3F8F5C]'}`}>
                {site.has_modifications ? '⚠️ Attention' : '✅ Serein'}
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
