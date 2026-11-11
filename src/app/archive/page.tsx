'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ArchivePage() {
  const [sites, setSites] = useState<any[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState(5);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadArchives = async () => {
    if (!pubkey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      if (res.ok) {
        setSites(d.sites || []);
        setIsPro(d.is_pro);
        setLimit(d.limit || 5);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchives(); }, [pubkey]);

  async function handleAdd() {
    if (!url || !pubkey) return;
    setAdding(true); setError('');
    try {
      const res = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, url })
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'Erreur');
      else { setUrl(''); loadArchives(); }
    } catch (e: any) {
      setError('Erreur réseau');
    }
    setAdding(false);
  }

  async function deleteSite(siteRoot: string, mainId: string) {
    if (!pubkey || !confirm('Supprimer ce site et toutes ses pages ?')) return;
    await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}&id=${mainId}`, { method: 'DELETE' });
    loadArchives();
  }

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-4xl mx-auto font-sans w-full min-h-screen">
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Archive</h1>
        <p className="text-sm text-[var(--text-muted)]">Surveillez l'intégrité des sites web en temps réel.</p>
      </div>

      {!isPro && (
        <div className="bg-[#FDF4F0] border border-[#FCE0D6] rounded-xl px-4 py-2 mb-6 inline-block">
          <p className="text-xs font-bold text-[#C44A2E]">
            Quota Gratuit : {sites.length} / {limit} sites
          </p>
        </div>
      )}

      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-8">
        <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 font-mono uppercase">
          Ajouter un site à surveiller
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input 
            type="url" 
            placeholder="https://www.exemple.com" 
            className="flex-1 min-w-0 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2]"
            style={{color: 'var(--text-main)'}}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button 
            onClick={handleAdd} 
            disabled={adding || (!isPro && sites.length >= limit)}
            className="bg-[#1A1513] text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-black transition whitespace-nowrap"
          >
            {adding ? '⏳ Scan...' : 'Ajouter'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
      </div>

      {loading ? (
        <p className="text-center font-mono py-10">Chargement...</p>
      ) : sites.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl">
          <div className="text-5xl mb-4">📡</div>
          <h3 className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>Aucun site surveillé</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto">
            Ajoutez l'URL d'un site pour que SCEAU le cartographie entièrement (jusqu'à 200 pages) et vous alerte au moindre changement.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((s) => (
            <Link 
              key={s.site_root} 
              href={`/archive/${s.root_id}`}
              className={`block bg-[var(--bg-surface)] border rounded-2xl p-5 hover:shadow-md transition ${s.children_modified > 0 ? 'border-[#FCE0D6] bg-[#FDF4F0]' : 'border-[var(--border-color)]'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg truncate" style={{color: 'var(--text-main)'}}>
                    {s.main_title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] truncate">{s.site_root}</p>
                </div>
                {s.children_modified > 0 ? (
                  <span className="shrink-0 bg-[#FDF4F0] text-[#C44A2E] border border-[#FCE0D6] px-3 py-1.5 rounded-full text-xs font-bold">
                    ⚠️ {s.children_modified} page{s.children_modified > 1 ? 's' : ''} modifiée{s.children_modified > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="shrink-0 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full text-xs font-bold">
                    ✅ Intact
                  </span>
                )}
              </div>
              
              {s.recent_changes && s.recent_changes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <p className="text-[0.65rem] font-mono font-bold uppercase text-[var(--text-muted)] mb-1">Dernier changement :</p>
                  <p className="text-sm italic text-[#C44A2E]">
                    "{s.recent_changes[0].ai_summary || 'Changement détecté'}"
                  </p>
                </div>
              )}
              
              <div className="flex justify-between items-center mt-3 text-xs text-[var(--text-muted)]">
                <span className="font-mono">
                  {s.children_count + 1} page{s.children_count > 0 ? 's' : ''} surveillée{s.children_count > 0 ? 's' : ''}
                </span>
                <span className="font-mono">
                  Vérifié {new Date(s.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
