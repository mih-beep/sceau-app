'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { generateCertificate } from '@/lib/pdf';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('public'); // public | friends | private | flash

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

  async function changeVisibility(sealId: string, newVisibility: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/seal/update-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seal_id: sealId, pubkey, visibility: newVisibility })
    });
    loadProfil(); // Recharger
  }

  function exportPortfolio() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;
    generateCertificate(`Portfolio de @${data.handle}`, data.handle, new Date().toISOString(), "Lien vers toutes les œuvres", "");
  }

  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  // Filtrer les sceaux selon l'onglet actif
  const filteredSeals = data.seals.filter((seal: any) => {
    if (activeTab === 'flash') return seal.is_flash === true;
    if (activeTab === 'public') return seal.visibility === 'public' && !seal.is_flash;
    if (activeTab === 'friends') return seal.visibility === 'friends' && !seal.is_flash;
    if (activeTab === 'private') return seal.visibility === 'private' && !seal.is_flash;
    return true;
  });

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <div className="text-center mb-6 relative">
        <Link href="/settings" className="absolute top-0 right-0 text-2xl opacity-50 hover:opacity-100 transition" title="Paramètres">⚙️</Link>
        
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-lg relative">
          {data.handle[0].toUpperCase()}
          {data.sealed >= 10 && (
            <div className="absolute bottom-0 right-0 bg-green-500 border-2 border-white rounded-full w-6 h-6 flex items-center justify-center text-xs" title="Créateur Actif">✓</div>
          )}
        </div>
        
        <h1 className="text-4xl font-bold mb-1" style={{color: 'var(--text-main)'}}>@{data.handle}</h1>
        <p className="text-sm font-mono text-[var(--text-muted)] uppercase tracking-wider">{data.role || 'Identité souveraine'}</p>
        {data.bio && <p className="mt-3 text-sm italic opacity-80 max-w-md mx-auto" style={{color: 'var(--text-main)'}}>"{data.bio}"</p>}
      </div>

      {data.badges.length > 0 && (
        <div className="mb-8 bg-[#FDF8F0] border border-[#EFE0CA] p-4 rounded-2xl">
          <h2 className="text-xs font-mono font-bold text-[#A89070] uppercase tracking-widest mb-3 text-center">Badges de Réputation</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {data.badges.map((badge: any, i: number) => (
              <div key={i} className="group relative flex flex-col items-center justify-center bg-white border border-[#EFE0CA] w-16 h-16 rounded-2xl shadow-sm hover:shadow-md transition cursor-help">
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
          <div className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)] mt-1">Scellés</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.hosted}</div>
          <div className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)] mt-1">Hébergés</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.pacts}</div>
          <div className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)] mt-1">Pactes</div>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button onClick={exportPortfolio} className="flex-1 bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm shadow-md hover:opacity-80 transition">📄 Export Portfolio PDF</button>
      </div>

      {/* LE COFFRE À 4 COMPARTIMENTS */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📚 Mon Coffre</h2>
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl">
          <button onClick={() => setActiveTab('public')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A] shadow' : 'opacity-50'}`}>🌍 Public</button>
          <button onClick={() => setActiveTab('friends')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E] shadow' : 'opacity-50'}`}>👥 Amis</button>
          <button onClick={() => setActiveTab('private')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E] shadow' : 'opacity-50'}`}>🔒 Privé</button>
          <button onClick={() => setActiveTab('flash')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'flash' ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash</button>
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
              <div className="text-xs text-[var(--text-muted)] font-mono">{new Date(seal.timestamp).toLocaleDateString('fr-FR')} • {seal.work_type || 'fichier'}</div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Menu pour déplacer l'œuvre */}
              <select 
                value={seal.is_flash ? 'flash' : seal.visibility} 
                onChange={(e) => changeVisibility(seal.id, e.target.value)}
                className="text-xs border border-[var(--border-color)] rounded-lg p-2 bg-[var(--bg-main)] font-bold outline-none cursor-pointer"
                style={{color: 'var(--text-main)'}}
                disabled={seal.is_flash} // On ne peut pas changer la visibilité d'un Flash
              >
                <option value="public">🌍 Rendre Public</option>
                <option value="friends">👥 Amis seulement</option>
                <option value="private">🔒 Rendre Privé</option>
                {seal.is_flash && <option value="flash">⚡ Flash (Local)</option>}
              </select>

              <button onClick={async () => {
                if (!confirm("Supprimer définitivement cette œuvre ?")) return;
                const p = localStorage.getItem('sceau_pubkey');
                await fetch(`/api/seal/delete?id=${seal.id}&pubkey=${encodeURIComponent(p!)}`, { method: 'DELETE' });
                loadProfil();
              }} className="text-red-400 hover:text-red-600 p-2 text-xl" title="Supprimer">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
