'use client';
import { useEffect, useState } from 'react';

export default function AccessLogModal({ sealId, onClose }: { sealId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) {
      setError("Tu dois être connecté pour voir le journal.");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    fetch(`/api/seal/${sealId}/access-log?pubkey=${encodeURIComponent(pubkey)}&search=${encodeURIComponent(search)}&sort=${sort}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Erreur de chargement");
        return d;
      })
      .then(d => { setEntries(d.entries || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [sealId, search, sort]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>📖 Journal des accès</h2>
          <button onClick={onClose} className="text-xl opacity-50 hover:opacity-100">✕</button>
        </div>

        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="Chercher un pseudo..." 
            className="flex-1 border-2 border-[var(--border-color)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#4A90C2] bg-[var(--bg-main)]"
            style={{color: 'var(--text-main)'}}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select 
            className="border-2 border-[var(--border-color)] rounded-xl px-2 py-2 text-xs font-bold outline-none bg-[var(--bg-main)] cursor-pointer"
            style={{color: 'var(--text-main)'}}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="recent">Récent</option>
            <option value="oldest_account">Anciens comptes</option>
            <option value="newest_account">Nouveaux comptes</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {loading ? <p className="text-center italic text-[var(--text-muted)] py-10 animate-pulse">Chargement...</p> :
           error ? <p className="text-center text-red-500 font-bold py-10">{error}</p> :
           entries.length === 0 ? <p className="text-center italic text-[var(--text-muted)] py-10">Aucun accès enregistré pour le moment.</p> :
           <div className="space-y-2">
             {entries.map((e, i) => (
               <div key={i} className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] flex justify-between items-center">
                 <div>
                   <span className="font-bold text-sm block" style={{color: 'var(--text-main)'}}>@{e.viewer}</span>
                   <div className="flex items-center gap-2 mt-1">
                     <span className={`text-[0.6rem] font-mono px-2 py-0.5 rounded ${e.action === 'download' ? 'bg-[#FCEAD6] text-[#C44A2E]' : 'bg-[#DCE8F5] text-[#2D6A9E]'}`}>{e.action}</span>
                     <span className="text-[0.65rem] text-[var(--text-muted)]">{new Date(e.at).toLocaleDateString('fr-FR')}</span>
                   </div>
                 </div>
                 {e.viewer_profile.account_age_days < 7 && <span className="text-[0.55rem] bg-red-100 text-red-600 font-bold px-2 py-1 rounded">Nouveau</span>}
               </div>
             ))}
           </div>
          }
        </div>
      </div>
    </div>
  );
}
