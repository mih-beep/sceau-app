'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ArchiveDetail() {
  const params = useParams();
  const router = useRouter();
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadArchive = async () => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.replace('/login'); return; }

    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      const found = (d.sites || []).find((s: any) => s.root_id === params.id);
      if (found) setSite(found);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchive(); }, [params.id]);

  async function runCheck() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey || !site) return;

    setChecking(true);
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url: site.root_id, action: 'check' })
    });
    await res.json();
    await loadArchive();
    setChecking(false);
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!site) return <div className="p-10 text-center">Archive introuvable.</div>;

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-3xl mx-auto font-sans w-full min-h-screen">
      
      <button onClick={() => router.push('/archive')} className="text-sm font-bold mb-4 flex items-center gap-2 opacity-60 hover:opacity-100" style={{color: 'var(--text-main)'}}>
        ← Retour
      </button>

      {/* HEADER RACINE */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold font-serif break-words leading-tight mb-1" style={{color: 'var(--text-main)'}}>
              {site.main_title}
            </h1>
            <a href={site.site_root} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4A90C2] hover:underline break-all">
              {site.site_root}
            </a>
          </div>
          <div className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 whitespace-nowrap ${
            site.children_modified > 0 ? 'bg-[#FDF4F0] text-[#C44A2E] border-2 border-[#FCE0D6]' : 'bg-green-50 text-green-700 border-2 border-green-200'
          }`}>
            {site.children_modified > 0 ? `⚠️ ${site.children_modified} page${site.children_modified > 1 ? 's' : ''} modifiée${site.children_modified > 1 ? 's' : ''}` : '✅ Intact'}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-color)]">
          <span>📄 {site.children_count + 1} page{site.children_count > 0 ? 's' : ''} surveillée{site.children_count > 0 ? 's' : ''}</span>
          <span>🔄 {site.scan_count} scan{site.scan_count > 1 ? 's' : ''}</span>
          <span>📅 Vérifié {new Date(site.last_checked_at).toLocaleString('fr-FR')}</span>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex-1 min-w-[180px] bg-[#1A1513] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition disabled:opacity-50"
        >
          {checking ? '⏳ Vérification...' : '🔄 Vérifier tout le site'}
        </button>
        <a
          href={site.site_root}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[180px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] py-3 rounded-xl font-bold text-sm text-center hover:border-[#E76F51] transition"
        >
          🌐 Visiter le site
        </a>
      </div>

      {/* CHANGEMENTS RÉCENTS */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3" style={{color: 'var(--text-main)'}}>
          📢 Changements récents
        </h2>
        
        {site.recent_changes && site.recent_changes.length > 0 ? (
          <div className="space-y-3">
            {site.recent_changes.map((change: any, i: number) => (
              <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 hover:shadow-md transition">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl shrink-0">📄</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>
                      {change.page_title || change.page_url}
                    </h3>
                    <p className="text-[0.65rem] text-[var(--text-muted)] font-mono mt-0.5">
                      {new Date(change.changed_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                
                {change.ai_summary ? (
                  <div className="bg-[#F0F6FC] border-l-4 border-[#4A90C2] rounded-r-lg p-3 mb-3">
                    <p className="text-sm italic text-[var(--text-main)]">
                      🧠 "{change.ai_summary}"
                    </p>
                  </div>
                ) : (
                  <p className="text-sm italic text-[var(--text-muted)] mb-3">
                    Modification détectée (résumé IA en attente)
                  </p>
                )}
                
                <Link 
                  href={`/o/${change.page_id}`} 
                  className="text-xs font-bold text-[#4A90C2] hover:underline break-all"
                >
                  Voir la page →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#F0FAF4] border-2 border-[#A8C77E] rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h3 className="font-bold text-[#3F8F5C] mb-2">Aucun changement détecté</h3>
            <p className="text-sm text-[#5D7A3A]">
              Le site est surveillé en continu. Vous serez alerté au moindre changement sur n'importe laquelle des {site.children_count + 1} pages.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
