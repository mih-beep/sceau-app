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

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadArchives = async () => {
    if (!pubkey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      if (res.ok) {
        setArchives(d.archives || []);
        setIsPro(d.is_pro);
        setLimit(d.limit);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchives(); }, [pubkey]);

  async function handleAdd() {
    if (!url || !pubkey) return;
    setAdding(true); setError('');
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url })
    });
    const d = await res.json();
    if (!res.ok) setError(d.error);
    else { setUrl(''); loadArchives(); }
    setAdding(false);
  }

  async function checkUrl(id: string) {
    if (!pubkey) return;
    setChecking(id);
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url: id, action: 'check' })
    });
    const d = await res.json();
    if (res.ok) loadArchives();
    else alert(d.error);
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
        <a href="/downloads/sceau-extension.zip" download className="bg-white border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold text-xs hover:border-[#E76F51] transition shadow-sm hidden md:block">
          Télécharger l'Extension Chrome
        </a>
        {!isPro && (
          <div className="bg-[#FDF4F0] border border-[#FCE0D6] px-4 py-2 rounded-lg text-right hidden md:block">
            <p className="text-xs font-bold text-[#C44A2E]">Quota Gratuit</p>
            <p className="text-[0.65rem] text-[#C44A2E]">{archives.length} / {limit} URLs</p>
          </div>
        )}
      </div>

      {/* Formulaire d'ajout */}
      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-8">
        <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 font-mono uppercase">Ajouter une URL à surveiller</label>
        <div className="flex gap-2">
          <input 
            type="url" 
            placeholder="https://www.concurrent.com" 
            className="flex-1 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2]"
            style={{color: 'var(--text-main)'}}
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button 
            onClick={handleAdd} 
            disabled={adding || (!isPro && archives.length >= limit)}
            className="bg-[#1A1513] text-white px-6 rounded-xl font-bold disabled:opacity-50 hover:bg-black transition"
          >
            {adding ? '...' : 'Sceller'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
        {!isPro && archives.length >= limit && (
          <p className="text-sm text-[#C44A2E] mt-3 font-bold">
            ⚠️ Limite de 3 URLs atteinte. <button onClick={() => alert("SCEAU PRO arrive bientôt ! Toutes les fonctionnalités restent gratuites pour le moment.")} className="underline">Passez à PRO</button> pour en ajouter plus.
          </p>
        )}
      </div>

      {/* Liste des archives */}
      {loading ? (
        <p className="text-center font-mono py-10">Chargement...</p>
      ) : archives.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl">
          <p className="text-[var(--text-muted)] italic">Vous ne surveillez aucun site pour le moment.</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
          {archives.map((a, i) => (
            <div key={a.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 ${i !== archives.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${a.status === 'modified' ? 'bg-[#FDF4F0]' : ''}`}>
              
              <div className="flex items-center gap-3 mb-3 md:mb-0">
                <div className={`w-2 h-2 rounded-full ${a.status === 'modified' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div>
                  <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{a.title || a.url}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate max-w-[300px]">{a.url}</p>
                  {a.status === 'modified' && <p className="text-[0.65rem] text-red-600 font-bold uppercase mt-1">Modification détectée</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">
                  Vérifié le {new Date(a.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
                <button 
                  onClick={() => checkUrl(a.id)} 
                  disabled={checking === a.id}
                  className="bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#E0EDF8] transition"
                >
                  {checking === a.id ? 'Scan...' : 'Vérifier'}
                </button>
                <button onClick={() => deleteUrl(a.id)} className="text-red-400 hover:text-red-600 px-2 text-lg">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
