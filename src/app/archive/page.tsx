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
        setSites(d.archives || []);
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
    if (!pubkey || !confirm('Supprimer ce site et toutes ses pages surveillées ?')) return;
    await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}&id=${mainId}`, { method: 'DELETE' });
    loadArchives();
  }

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-4xl mx-auto font-sans w-full min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Archive</h1>
          <p className="text-sm text-[var(--text-muted)]">Surveillez l'intégrité des sites web. Détectez les modifications en un clic.</p>
        </div>
        <a 
          href="/downloads/sceau-extension.zip" 
          download 
          className="bg-white border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold text-xs hover:border-[#E76F51] transition shadow-sm hidden md:block"
        >
          Télécharger l'Extension Chrome
        </a>
      </div>

      {/* Quota */}
      {!isPro && (
        <div className="bg-[#FDF4F0] border border-[#FCE0D6] rounded-xl px-4 py-2 mb-6 inline-block">
          <p className="text-xs font-bold text-[#C44A2E]">
            Quota Gratuit : {sites.length} / {limit} sites
          </p>
        </div>
      )}

      {/* Formulaire */}
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
            {adding ? '...' : 'Sceller'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
        {!isPro && sites.length >= limit && (
          <p className="text-sm text-[#C44A2E] mt-3 font-bold">
            ⚠️ Limite de {limit} sites atteinte. <button onClick={() => alert("SCEAU PRO arrive bientôt !")} className="underline">Passez à PRO</button> pour en ajouter plus.
          </p>
        )}
      </div>

      {/* Liste groupée */}
      {loading ? (
        <p className="text-center font-mono py-10">Chargement...</p>
      ) : sites.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl">
          <div className="text-5xl mb-4">📡</div>
          <h3 className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>Aucun site surveillé</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto">
            Ajoutez l'URL d'un site pour que SCEAU le scanne chaque jour et vous alerte en cas de modification.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
          {sites.map((s, i) => (
            <div 
              key={s.site_root} 
              className={`flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-[var(--bg-main)] transition ${i !== sites.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${s.has_modifications ? 'bg-[#FDF4F0]' : ''}`}
            >
              <Link href={`/archive/${s.main_id}`} className="flex items-center gap-3 mb-3 md:mb-0 flex-1 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${s.has_modifications ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>
                    {s.main_title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {s.site_root}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[0.6rem] font-mono bg-[var(--bg-main)] border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                      {s.pages_count} page{s.pages_count > 1 ? 's' : ''}
                    </span>
                    {s.has_modifications && (
                      <span className="text-[0.6rem] font-bold bg-[#FDF4F0] text-[#C44A2E] border border-[#FCE0D6] px-1.5 py-0.5 rounded">
                        Modifié
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">
                  {new Date(s.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
                <Link
                  href={`/archive/${s.main_id}`}
                  className="bg-[#1A1513] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition"
                >
                  Voir →
                </Link>
                <button 
                  onClick={() => deleteSite(s.site_root, s.main_id)} 
                  className="text-red-400 hover:text-red-600 px-2 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
