'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  async function loadProfil() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.push('/login'); return; }
    
    try {
      const res = await fetch(`/api/profil?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      
      if (res.ok && d.handle) {
        setData({ ...d, seals: d.seals || [] }); // Sécurité si seals est null
      } else {
        setError("Profil introuvable. Déconnecte-toi et reconnecte-toi.");
      }
    } catch (e) {
      setError("Erreur de connexion au serveur.");
    }
  }

  useEffect(() => { loadProfil(); }, [router]);

  async function deleteSeal(id: string) {
    if (!confirm("Supprimer cette œuvre ?")) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch(`/api/seal/delete?id=${id}&pubkey=${encodeURIComponent(pubkey!)}`, { method: 'DELETE' });
    loadProfil();
  }

  if (error) return (
    <div className="p-10 text-center font-mono">
      <p className="text-red-500 font-bold mb-4">{error}</p>
      <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="bg-[#E76F51] text-white px-4 py-2 rounded-xl font-bold">Se déconnecter</button>
    </div>
  );
  
  if (!data) return <div className="p-10 text-center font-mono" style={{color: 'var(--text-main)'}}>Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-lg">
          {data.handle[0].toUpperCase()}
        </div>
        <h1 className="text-4xl font-bold mb-1" style={{color: 'var(--text-main)'}}>@{data.handle}</h1>
        <p className="text-sm font-mono text-[var(--text-muted)]">Identité souveraine</p>
      </div>

      <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl justify-around mb-8 shadow-sm">
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.sealed}</div>
          <div className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)] mt-1">Scellés</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.hosted}</div>
          <div className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)] mt-1">Hébergés</div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📚 Mon Coffre</h2>
      <div className="space-y-3 mb-10">
        {data.seals.length === 0 && <p className="text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center">Ton coffre est vide.</p>}
        {data.seals.map((seal: any) => (
          <div key={seal.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] flex justify-between items-center shadow-sm">
            <div>
              <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{seal.title}</div>
              <div className="text-xs text-[var(--text-muted)] font-mono mt-1">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div>
            </div>
            <button onClick={() => deleteSeal(seal.id)} className="text-red-400 hover:text-red-600 p-2 text-xl">🗑️</button>
          </div>
        ))}
      </div>

      <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="w-full py-4 text-red-500 font-bold border border-red-500 rounded-xl hover:bg-red-50 transition">
        Se déconnecter
      </button>
    </div>
  );
}
