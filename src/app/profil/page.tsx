'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { generatePortfolioPDF } from '@/lib/pdf';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('public');

  // États Portfolio
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [selectedSeals, setSelectedSeals] = useState<string[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function loadProfil() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.push('/login'); return; }
    try {
      const res = await fetch(`/api/profil?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      if (res.ok && d.handle) setData({ ...d, seals: d.seals || [], badges: d.badges || [] });
      else setError("Profil introuvable.");
    } catch (e) { setError("Erreur serveur."); }
  }

  useEffect(() => { loadProfil(); }, [router]);

  // --- LOGIQUE PORTFOLIO ---
  const openPortfolioModal = () => {
    setShowPortfolioModal(true);
    setSelectedSeals(data.seals.map((s: any) => s.id));
    setFilterType('all');
    setStartDate('');
    setEndDate('');
  };

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

  const handleTypeChange = (type: string) => { setFilterType(type); applyFilters(type, startDate, endDate); };
  const handleStartDate = (date: string) => { setStartDate(date); applyFilters(filterType, date, endDate); };
  const handleEndDate = (date: string) => { setEndDate(date); applyFilters(filterType, startDate, date); };

  const toggleSeal = (id: string) => {
    if (selectedSeals.includes(id)) setSelectedSeals(selectedSeals.filter(sid => sid !== id));
    else setSelectedSeals([...selectedSeals, id]);
  };

  const generatePDF = () => {
    const sealsToInclude = data.seals.filter((s: any) => selectedSeals.includes(s.id));
    if (sealsToInclude.length === 0) return alert("Sélectionne au moins une œuvre !");
    generatePortfolioPDF(data.handle, sealsToInclude, startDate, endDate);
    setShowPortfolioModal(false);
  };

  // Changement de visibilité
  async function changeVisibility(sealId: string, newVisibility: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/seal/update-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seal_id: sealId, pubkey, visibility: newVisibility })
    });
    loadProfil();
  }

  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  // Compteurs par catégorie
  const counts = {
    public: data.seals.filter((s:any) => s.visibility === 'public' && !s.is_flash).length,
    friends: data.seals.filter((s:any) => s.visibility === 'friends' && !s.is_flash).length,
    private: data.seals.filter((s:any) => s.visibility === 'private' && !s.is_flash).length,
    flash: data.seals.filter((s:any) => s.is_flash).length,
  };

  const filteredSeals = data.seals.filter((seal: any) => {
    if (activeTab === 'flash') return seal.is_flash === true;
    if (activeTab === 'public') return seal.visibility === 'public' && !seal.is_flash;
    if (activeTab === 'friends') return seal.visibility === 'friends' && !seal.is_flash;
    if (activeTab === 'private') return seal.visibility === 'private' && !seal.is_flash;
    return true;
  });

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif relative">
      
      {/* EN-TÊTE */}
      <div className="text-center mb-6 relative">
        <Link href="/settings" className="absolute top-0 right-0 text-2xl opacity-50 hover:opacity-100 transition" title="Paramètres">⚙️</Link>
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-lg relative">
          {data.handle[0].toUpperCase()}
          {data.sealed >= 10 && <div className="absolute bottom-0 right-0 bg-green-500 border-2 border-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✓</div>}
        </div>
        <h1 className="text-4xl font-bold mb-1" style={{color: 'var(--text-main)'}}>@{data.handle}</h1>
        <p className="text-sm font-mono text-[var(--text-muted)] uppercase tracking-wider">{data.role || 'Identité souveraine'}</p>
      </div>

      <div className="flex gap-4 mb-8">
        <button onClick={openPortfolioModal} className="flex-1 bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm shadow-md hover:opacity-80 transition">📄 Exporter mon Portfolio</button>
      </div>

      {/* LE COFFRE AVEC COMPTEURS */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📚 Mon Coffre</h2>
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl">
          <button onClick={() => setActiveTab('public')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A] shadow' : 'opacity-50'}`}>🌍 Public ({counts.public})</button>
          <button onClick={() => setActiveTab('friends')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E] shadow' : 'opacity-50'}`}>👥 Amis ({counts.friends})</button>
          <button onClick={() => setActiveTab('private')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E] shadow' : 'opacity-50'}`}>🔒 Privé ({counts.private})</button>
          <button onClick={() => setActiveTab('flash')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'flash' ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash ({counts.flash})</button>
        </div>
      </div>

      {/* LISTE DES OEUVRES */}
      <div className="space-y-3 mb-10">
        {filteredSeals.length === 0 && <p className="text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center">Aucune œuvre dans ce compartiment.</p>}
        
        {filteredSeals.map((seal: any) => (
          <div key={seal.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col sm:flex-row justify-between sm:items-center shadow-sm gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                {seal.is_flash && <span className="text-xs bg-[#FCEAD6] text-[#C44A2E] px-2 py-0.5 rounded">Flash</span>}
              </div>
              {seal.description && <div className="text-xs italic text-[var(--text-muted)] mb-2">"{seal.description}"</div>}
              <div className="flex gap-3 text-xs font-mono text-[var(--text-muted)]">
                <span>{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</span>
                <span>❤️ {seal.likes_count || 0}</span>
                <span>💬 {seal.comments_count || 0}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={seal.is_flash ? 'flash' : seal.visibility} 
                onChange={(e) => changeVisibility(seal.id, e.target.value)}
                className="text-xs border border-[var(--border-color)] rounded-lg p-2 bg-[var(--bg-main)] font-bold outline-none cursor-pointer"
                style={{color: 'var(--text-main)'}}
                disabled={seal.is_flash}
              >
                <option value="public">🌍 Public</option>
                <option value="friends">👥 Amis</option>
                <option value="private">🔒 Privé</option>
                {seal.is_flash && <option value="flash">⚡ Flash</option>}
              </select>
              <button onClick={async () => {
                if (!confirm("Supprimer définitivement cette œuvre ?")) return;
                const p = localStorage.getItem('sceau_pubkey');
                await fetch(`/api/seal/delete?id=${seal.id}&pubkey=${encodeURIComponent(p!)}`, { method: 'DELETE' });
                loadProfil();
              }} className="text-red-400 hover:text-red-600 p-2 text-xl">🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* MODALE PORTFOLIO (Avec dates) */}
      {showPortfolioModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Configurer le Portfolio</h2>
            
            <div className="flex bg-[var(--bg-main)] p-1 rounded-xl mb-3 text-[0.65rem] font-mono font-bold">
              <button onClick={() => handleTypeChange('all')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'all' ? 'bg-white shadow' : 'opacity-50'}`}>Tout</button>
              <button onClick={() => handleTypeChange('public')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'public' ? 'bg-white shadow text-[#5D7A3A]' : 'opacity-50'}`}>Public</button>
              <button onClick={() => handleTypeChange('friends')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'friends' ? 'bg-white shadow text-[#2D6A9E]' : 'opacity-50'}`}>Amis</button>
              <button onClick={() => handleTypeChange('private')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'private' ? 'bg-white shadow text-[#C44A2E]' : 'opacity-50'}`}>Privé</button>
              <button onClick={() => handleTypeChange('flash')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'flash' ? 'bg-white shadow text-[#C44A2E]' : 'opacity-50'}`}>Flash</button>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <label className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase mb-1 block">Du</label>
                <input type="date" value={startDate} onChange={e => handleStartDate(e.target.value)} className="w-full border border-[var(--border-color)] p-2 rounded-lg text-xs bg-transparent" style={{color: 'var(--text-main)'}} />
              </div>
              <div className="flex-1">
                <label className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase mb-1 block">Au</label>
                <input type="date" value={endDate} onChange={e => handleEndDate(e.target.value)} className="w-full border border-[var(--border-color)] p-2 rounded-lg text-xs bg-transparent" style={{color: 'var(--text-main)'}} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
              {data.seals.map((seal: any) => (
                <label key={seal.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-main)] cursor-pointer transition">
                  <input type="checkbox" checked={selectedSeals.includes(seal.id)} onChange={() => toggleSeal(seal.id)} className="w-5 h-5 accent-[#E76F51]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                    <div className="text-[0.6rem] font-mono text-[var(--text-muted)]">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPortfolioModal(false)} className="flex-1 py-3 font-bold opacity-50">Annuler</button>
              <button onClick={generatePDF} className="flex-1 bg-[var(--text-main)] text-white py-3 rounded-xl font-bold shadow-md">Générer ({selectedSeals.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
