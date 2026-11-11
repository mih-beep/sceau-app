'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { generatePortfolioPDF } from '@/lib/pdf';
import AccessLogModal from './AccessLogModal';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('public');

  // Modales
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [selectedSeals, setSelectedSeals] = useState<string[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accessLogSealId, setAccessLogSealId] = useState<string | null>(null);
  const [showAccessLogList, setShowAccessLogList] = useState(false);
  const [showTechProofs, setShowTechProofs] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  async function loadProfil() {
    const handle = localStorage.getItem('sceau_handle');
    if (!handle) { router.replace('/login'); return; }

    try {
      const pubkey = localStorage.getItem('sceau_pubkey');
      const res = await fetch(`/api/profil?handle=${encodeURIComponent(handle)}${pubkey ? `&pubkey=${encodeURIComponent(pubkey)}` : ''}`, { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Impossible de charger le profil.");
      setData({ ...d, seals: d.seals || [], badges: d.badges || [], favorites: d.favorites || [], projects: d.projects || [] });
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => { loadProfil(); }, [router]);

  const applyFilters = (type: string, start: string, end: string) => {
    let filtered = data.seals;
    if (type !== 'all') {
      if (type === 'flash') filtered = filtered.filter((s: any) => s.is_flash);
      else filtered = filtered.filter((s: any) => s.visibility === type && !s.is_flash);
    }
    if (start) filtered = filtered.filter((s: any) => new Date(s.timestamp) >= new Date(start));
    if (end) filtered = filtered.filter((s: any) => new Date(s.timestamp) <= new Date(end));
    setSelectedSeals(filtered.map((s: any) => s.id));
  };

  const toggleSeal = (id: string) => {
    if (selectedSeals.includes(id)) setSelectedSeals(selectedSeals.filter(sid => sid !== id));
    else setSelectedSeals([...selectedSeals, id]);
  };

  const generatePDF = () => {
    const sealsToInclude = data.seals.filter((s: any) => selectedSeals.includes(s.id));
    if (sealsToInclude.length === 0) return alert("Sélectionne au moins une œuvre !");
    generatePortfolioPDF(data.handle, sealsToInclude, startDate, endDate, data.is_pro);
    setShowPortfolioModal(false);
  };

  async function changeVisibility(sealId: string, newVisibility: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/seal/update-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seal_id: sealId, pubkey, visibility: newVisibility })
    });
    loadProfil();
  }

  async function refreshOts(sealId: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert('Connecte-toi.');
    setRefreshingId(sealId);
    try {
      const res = await fetch(`/api/seal/${sealId}/ots/refresh?pubkey=${encodeURIComponent(pubkey)}`, { method: 'POST' });
      const d = await res.json();
      if (d.status === 'upgraded') { alert('✅ Preuve mise à jour !'); await loadProfil(); }
      else alert('⏳ ' + (d.message || 'Pas encore confirmé.'));
    } catch { alert('❌ Erreur'); } finally { setRefreshingId(null); }
  }

  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  const counts = {
    public: data.seals.filter((s:any) => s.visibility === 'public' && !s.is_flash).length,
    friends: data.seals.filter((s:any) => s.visibility === 'friends' && !s.is_flash).length,
    private: data.seals.filter((s:any) => s.visibility === 'private' && !s.is_flash).length,
    flash: data.seals.filter((s:any) => s.is_flash).length,
    projects: data.projects.length,
    extensions: data.seals.filter((s:any) => s.category === 'Web').length,
  };

  // ONGLET FAVORIS
  if (activeTab === 'favorites') {
    return (
      <div className="p-6 pb-32 max-w-2xl mx-auto font-sans">
        <button onClick={() => setActiveTab('public')} className="text-sm font-bold text-[#A89070] mb-4 hover:underline">← Retour au coffre</button>
        <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📌 Mes Favoris</h2>
        <div className="grid gap-3">
          {data.favorites?.map((fav: any) => (
            <Link href={`/o/${fav.id}`} key={fav.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] block hover:border-[#E76F51]">
              <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{fav.title}</div>
              <div className="text-xs text-[var(--text-muted)]">Par @{fav.author} • {new Date(fav.timestamp).toLocaleDateString('fr-FR')}</div>
            </Link>
          ))}
          {(!data.favorites || data.favorites.length === 0) && <p className="italic text-[var(--text-muted)] text-center py-10">Aucune œuvre sauvegardée.</p>}
        </div>
      </div>
    );
  }

  const filteredSeals = data.seals.filter((seal: any) => {
    if (activeTab === 'flash') return seal.is_flash === true;
    if (activeTab === 'public') return seal.visibility === 'public' && !seal.is_flash;
    if (activeTab === 'friends') return seal.visibility === 'friends' && !seal.is_flash;
    if (activeTab === 'private') return seal.visibility === 'private' && !seal.is_flash;
    if (activeTab === 'extensions') return seal.category === 'Web';
    return true;
  });

  return (
    <div className="p-6 max-w-2xl md:max-w-5xl mx-auto font-serif relative w-full pb-32">
      
      <div className="text-center mb-6 relative">
        <Link href="/settings" className="absolute top-0 right-0 text-2xl opacity-50 hover:opacity-100 transition" title="Paramètres">⚙️</Link>
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-lg">
          {data.handle[0].toUpperCase()}
        </div>
        <h1 className="text-4xl font-bold mb-1 flex items-center justify-center gap-2" style={{color: 'var(--text-main)'}}>
          @{data.handle} {data.is_pro && <span className="text-sm bg-[#2C1810] text-[#E9C46A] px-2 py-1 rounded-lg">👑 PRO</span>}
        </h1>
        <p className="text-sm font-mono text-[var(--text-muted)] italic">{data.role || 'Identité souveraine'}</p>
        {data.bio && <p className="mt-3 text-sm italic opacity-80 max-w-md mx-auto" style={{color: 'var(--text-main)'}}>"{data.bio}"</p>}
      </div>

      {/* Actions Rapides (Retour des boutons perdus) */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button onClick={() => { setShowPortfolioModal(true); setSelectedSeals(data.seals.map((s:any)=>s.id)); }} className="flex-1 min-w-[180px] bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm shadow-md hover:opacity-80 transition">📄 Exporter Portfolio</button>
        <button onClick={() => setShowAccessLogList(true)} className="flex-1 min-w-[180px] bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] p-3 rounded-xl font-bold text-sm hover:bg-[#E0EDF8] transition">📖 Journal des accès</button>
        <button onClick={() => setShowTechProofs(true)} className="flex-1 min-w-[180px] bg-[#FDF8F0] text-[#A88620] border border-[#E9C46A] p-3 rounded-xl font-bold text-sm hover:bg-[#FCEFCB] transition">🔬 Preuves techniques</button>
        <a href="/downloads/chrome-extension.zip" download className="flex-1 min-w-[180px] bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] p-3 rounded-xl font-bold text-sm hover:bg-[#E0EDF8] transition text-center">🧩 Extension Chrome</a>
      </div>

      <div className="mb-4">
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl flex-wrap sm:flex-nowrap gap-1">
          <button onClick={() => setActiveTab('public')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A]' : 'opacity-50'}`}>🌍 Public</button>
          <button onClick={() => setActiveTab('friends')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E]' : 'opacity-50'}`}>👥 Amis</button>
          <button onClick={() => setActiveTab('private')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E]' : 'opacity-50'}`}>🔒 Privé</button>
          <button onClick={() => setActiveTab('flash')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'flash' ? 'bg-[#2C1810] text-white' : 'opacity-50'}`}>⚡ Flash</button>
          <button onClick={() => setActiveTab('extensions')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'extensions' ? 'bg-[#F0F6FC] text-[#2D6A9E]' : 'opacity-50'}`}>🔌 Ext ({counts.extensions})</button>
          <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'favorites' ? 'bg-[#FCEAD6] text-[#C44A2E]' : 'opacity-50'}`}>📌 Favoris</button>
        </div>
      </div>

      <div className="space-y-3 mb-10">
        {filteredSeals.length === 0 && <p className="text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center border">Aucune œuvre dans ce compartiment.</p>}
        {filteredSeals.map((seal: any) => (
          <div key={seal.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center shadow-sm gap-3">
            <div className="flex-1">
              <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{seal.title}</div>
              <div className="flex gap-3 text-xs font-mono text-[var(--text-muted)] mt-1">
                <span>{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</span>
                <span>❤️ {seal.likes_count || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAccessLogSealId(seal.id)} className="text-xs font-bold text-[#4A90C2] hover:underline px-2">📖</button>
              <select value={seal.is_flash ? 'flash' : seal.visibility} onChange={(e) => changeVisibility(seal.id, e.target.value)} className="text-xs border rounded-lg p-2 bg-[var(--bg-main)] font-bold" style={{color: 'var(--text-main)'}} disabled={seal.is_flash}>
                <option value="public">🌍 Public</option>
                <option value="friends">👥 Amis</option>
                <option value="private">🔒 Privé</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* MODALES RESTAURÉES */}
      {showPortfolioModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Configurer le Portfolio</h2>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {data.seals.map((seal: any) => (
                <label key={seal.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-[var(--bg-main)] cursor-pointer">
                  <input type="checkbox" checked={selectedSeals.includes(seal.id)} onChange={() => toggleSeal(seal.id)} className="w-5 h-5 accent-[#E76F51]" />
                  <div className="font-bold text-sm truncate">{seal.title}</div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPortfolioModal(false)} className="flex-1 py-3 font-bold opacity-50">Annuler</button>
              <button onClick={generatePDF} className="flex-1 bg-[var(--text-main)] text-white py-3 rounded-xl font-bold shadow-md">Générer</button>
            </div>
          </div>
        </div>
      )}

      {accessLogSealId && <AccessLogModal sealId={accessLogSealId} onClose={() => setAccessLogSealId(null)} />}

      {showTechProofs && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>🔬 Preuves techniques</h2>
              <button onClick={() => setShowTechProofs(false)} className="text-2xl opacity-50">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {data.seals.map((seal: any) => (
                <div key={seal.id} className="bg-[var(--bg-main)] border rounded-xl p-4">
                  <div className="font-bold text-sm mb-2">{seal.title}</div>
                  <div className="flex gap-2">
                    {seal.ots_proof ? (
                      <button onClick={() => refreshOts(seal.id)} disabled={refreshingId === seal.id} className="bg-white border-2 border-[#7A9B5A] text-[#5D7A3A] px-3 py-1.5 rounded-lg text-xs font-bold">
                        {refreshingId === seal.id ? '⏳...' : '🔄 Vérifier confirmation'}
                      </button>
                    ) : <span className="text-xs italic opacity-50">Pas d'ancrage Bitcoin.</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
