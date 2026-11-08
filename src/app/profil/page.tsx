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
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.push('/login'); return; }
    try {
      const res = await fetch(`/api/profil?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      if (res.ok && d.handle) setData({ ...d, seals: d.seals || [], badges: d.badges || [], favorites: d.favorites || [] });
      else setError("Profil introuvable.");
    } catch (e) { setError("Erreur serveur."); }
  }

  useEffect(() => { loadProfil(); }, [router]);

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

  function openTechProofs() {
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
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  const counts = {
    public: data.seals.filter((s:any) => s.visibility === 'public' && !s.is_flash).length,
    friends: data.seals.filter((s:any) => s.visibility === 'friends' && !s.is_flash).length,
    private: data.seals.filter((s:any) => s.visibility === 'private' && !s.is_flash).length,
    flash: data.seals.filter((s:any) => s.is_flash).length,
  };

  // ONGLET FAVORIS
  if (activeTab === 'favorites') {
    return (
      <div className="p-6 max-w-2xl mx-auto font-sans">
        <button onClick={() => setActiveTab('public')} className="text-sm font-bold text-[#A89070] mb-4 hover:underline">← Retour au coffre</button>
        <button onClick={openTechProofs} className="mb-4 bg-[#FDF8F0] text-[#A88620] border border-[#E9C46A] px-4 py-2 rounded-lg font-bold text-sm shadow-sm">🔬 Preuves techniques</button>
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
    return true;
  });

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif relative">
      
      <div className="text-center mb-6 relative">
        <Link href="/settings" className="absolute top-0 right-0 text-2xl opacity-50 hover:opacity-100 transition" title="Paramètres">⚙️</Link>
        
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-lg relative">
          {data.handle[0].toUpperCase()}
          {data.sealed >= 10 && <div className="absolute bottom-0 right-0 bg-green-500 border-2 border-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✓</div>}
        </div>
        
        <h1 className="text-4xl font-bold mb-1 flex items-center justify-center gap-2" style={{color: 'var(--text-main)'}}>
          @{data.handle}
          {data.is_pro && <span className="text-sm bg-[#2C1810] text-[#E9C46A] px-2 py-1 rounded-lg border border-[#E9C46A] tracking-widest">👑 PRO</span>}
          {data.streak > 0 && <span className="text-sm bg-[#FDF4F0] text-[#C44A2E] px-2 py-1 rounded-lg border border-[#FCE0D6]">🔥 {data.streak} jours</span>}
        </h1>
        <p className="text-sm font-mono text-[var(--text-muted)] italic">{data.role || 'Identité souveraine'}</p>
        {data.bio && <p className="mt-3 text-sm italic opacity-80 max-w-md mx-auto" style={{color: 'var(--text-main)'}}>"{data.bio}"</p>}
      </div>

      {data.badges.length > 0 && (
        <div className="mb-8 bg-[#FDF8F0] border border-[#EFE0CA] p-4 rounded-2xl">
          <h2 className="text-xs font-mono font-bold text-[#A89070] italic mb-3 text-center">Badges</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {data.badges.map((badge: any, i: number) => (
              <div key={i} className="flex flex-col items-center justify-center bg-white border border-[#EFE0CA] w-16 h-16 rounded-2xl shadow-sm cursor-help" title={badge.desc}>
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-[0.55rem] font-bold text-[#7A5A3A] mt-1">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl justify-around mb-8 shadow-sm">
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.sealed}</div>
          <div className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-1">Scellés</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.hosted}</div>
          <div className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-1">Hébergés</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.pacts}</div>
          <div className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-1">Pactes</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button onClick={openPortfolioModal} className="flex-1 min-w-[180px] bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm shadow-md hover:opacity-80 transition">📄 Exporter mon Portfolio</button>
        <button onClick={() => setShowAccessLogList(true)} className="flex-1 min-w-[180px] bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] p-3 rounded-xl font-bold text-sm shadow-sm hover:bg-[#E0EDF8] transition">📖 Journal des accès</button>
        <button onClick={openTechProofs} className="flex-1 min-w-[180px] bg-[#FDF8F0] text-[#A88620] border border-[#E9C46A] p-3 rounded-xl font-bold text-sm shadow-sm hover:bg-[#FCEFCB] transition">🔬 Preuves techniques</button>
      </div>

      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📚 Mon Coffre</h2>
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl flex-wrap sm:flex-nowrap gap-1">
          <button onClick={() => setActiveTab('public')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A] shadow' : 'opacity-50'}`}>🌍 Public ({counts.public})</button>
          <button onClick={() => setActiveTab('friends')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E] shadow' : 'opacity-50'}`}>👥 Amis ({counts.friends})</button>
          <button onClick={() => setActiveTab('private')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E] shadow' : 'opacity-50'}`}>🔒 Privé ({counts.private})</button>
          <button onClick={() => setActiveTab('flash')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'flash' ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash ({counts.flash})</button>
          <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'favorites' ? 'bg-[#FCEAD6] text-[#C44A2E] shadow' : 'opacity-50'}`}>📌 Favoris ({data.favorites?.length || 0})</button>
        </div>
      </div>

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
              <button onClick={() => setAccessLogSealId(seal.id)} className="text-xs font-bold text-[#4A90C2] hover:underline px-2" title="Voir le journal des accès">📖</button>
              <select value={seal.is_flash ? 'flash' : seal.visibility} onChange={(e) => changeVisibility(seal.id, e.target.value)} className="text-xs border border-[var(--border-color)] rounded-lg p-2 bg-[var(--bg-main)] font-bold outline-none cursor-pointer" style={{color: 'var(--text-main)'}} disabled={seal.is_flash}>
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

      {showPortfolioModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Configurer le Portfolio</h2>
            <div className="flex bg-[var(--bg-main)] p-1 rounded-xl mb-3 text-[0.65rem] font-mono font-bold">
              <button onClick={() => handleTypeChange('all')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'all' ? 'bg-white shadow' : 'opacity-50'}`}>Tout</button>
              <button onClick={() => handleTypeChange('public')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'public' ? 'bg-white shadow text-[#5D7A3A]' : 'opacity-50'}`}>Public</button>
              <button onClick={() => handleTypeChange('private')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'private' ? 'bg-white shadow text-[#C44A2E]' : 'opacity-50'}`}>Privé</button>
              <button onClick={() => handleTypeChange('flash')} className={`flex-1 py-1.5 rounded-lg ${filterType === 'flash' ? 'bg-white shadow text-[#C44A2E]' : 'opacity-50'}`}>Flash</button>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <label className="text-[0.6rem] font-bold text-[var(--text-muted)] mb-1 block">Du</label>
                <input type="date" value={startDate} onChange={e => handleStartDate(e.target.value)} className="w-full border border-[var(--border-color)] p-2 rounded-lg text-xs bg-transparent" style={{color: 'var(--text-main)'}} />
              </div>
              <div className="flex-1">
                <label className="text-[0.6rem] font-bold text-[var(--text-muted)] mb-1 block">Au</label>
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
      {accessLogSealId && <AccessLogModal sealId={accessLogSealId} onClose={() => setAccessLogSealId(null)} />}

      {/* MODALE — PREUVES TECHNIQUES (propriétaire uniquement) */}
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
      {showAccessLogList && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>Journal des accès</h2>
              <button onClick={() => setShowAccessLogList(false)} className="text-2xl opacity-50">✕</button>
            </div>
            <p className="text-sm text-[var(--text-muted)] italic mb-4">Sélectionne une œuvre pour voir qui l'a consultée ou téléchargée.</p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {data.seals.map((seal: any) => (
                <div 
                  key={seal.id} 
                  onClick={() => { setShowAccessLogList(false); setAccessLogSealId(seal.id); }} 
                  className="p-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-main)] cursor-pointer transition flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <span className="text-[#4A90C2] text-sm font-bold">Voir →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
