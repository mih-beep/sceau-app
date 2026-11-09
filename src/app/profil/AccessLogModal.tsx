'use client';
import { useEffect, useState } from 'react';

export default function AccessLogModal({ sealId, onClose }: { sealId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    setLoading(true);
    fetch(`/api/seal/${sealId}/access-log?pubkey=${encodeURIComponent(pubkey || '')}&search=${search}&sort=${sort}`)
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setLoading(false); });
  }, [sealId, search, sort]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>📖 Journal des accès</h2>
          <button onClick={onClose} className="text-xl opacity-50">✕</button>
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
            <option value="recent">Vues récentes</option>
            <option value="newest_account">Comptes les + récents</option>
            <option value="oldest_account">Comptes les + anciens</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="text-center italic text-[var(--text-muted)]">Chargement...</p> :
           entries.length === 0 ? <p className="text-center italic text-[var(--text-muted)] py-8">Aucun accès enregistré pour le moment.</p> :
           <div className="space-y-2">
             {entries.map((e, i) => (
               <div key={i} className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]">
                 <div className="flex justify-between items-baseline">
                   <span className="font-bold text-sm" style={{color: 'var(--text-main)'}}>@{e.viewer}</span>
                   <div className="flex items-center gap-2">
                     {e.viewer_profile.account_age_days < 7 && <span className="text-[0.55rem] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded uppercase">Nouveau</span>}
                     <span className={`text-[0.6rem] font-mono px-2 py-0.5 rounded ${e.action === 'download' ? 'bg-[#FCEAD6] text-[#C44A2E]' : 'bg-[#DCE8F5] text-[#2D6A9E]'}`}>{e.action}</span>
                   </div>
                 </div>
                 <div className="text-xs text-[var(--text-muted)] mt-1">
                   {new Date(e.at).toLocaleString('fr-FR')} · compte de {e.viewer_profile.account_age_days} jours · {e.viewer_profile.seals_count} sceaux
                 </div>
               </div>
             ))}
           </div>
          }
        </div>
      </div>
    </div>
  );
}
