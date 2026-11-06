'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { generateCertificate } from '@/lib/pdf';

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
      if (res.ok && d.handle) setData({ ...d, seals: d.seals || [] });
      else setError("Profil introuvable.");
    } catch (e) { setError("Erreur serveur."); }
  }

  useEffect(() => { loadProfil(); }, [router]);

  function exportPortfolio() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;
    generateCertificate(`Portfolio de @${data.handle}`, data.handle, new Date().toISOString(), "Lien vers toutes les œuvres", "");
  }

  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  const isActiveCreator = data.sealed >= 10;

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      
      {/* En-tête du profil */}
      <div className="text-center mb-6 relative">
        <Link href="/settings" className="absolute top-0 right-0 text-2xl opacity-50 hover:opacity-100 transition" title="Paramètres">⚙️</Link>
        
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-lg">
          {data.handle[0].toUpperCase()}
        </div>
        <h1 className="text-4xl font-bold mb-1 flex items-center justify-center gap-2" style={{color: 'var(--text-main)'}}>
          @{data.handle}
          {isActiveCreator && <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-300" title="Créateur Actif">✔️ Actif</span>}
        </h1>
        <p className="text-sm font-mono text-[var(--text-muted)]">{data.role || 'Identité souveraine'}</p>
        {data.bio && <p className="mt-3 text-sm italic opacity-80 max-w-md mx-auto" style={{color: 'var(--text-main)'}}>"{data.bio}"</p>}
      </div>

      {/* Statistiques */}
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

      <div className="flex gap-4 mb-8">
        <button onClick={exportPortfolio} className="flex-1 bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm shadow-md hover:opacity-80 transition">📄 Export Portfolio PDF</button>
      </div>

      <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📚 Mon Coffre</h2>
      <div className="space-y-3 mb-10">
        {data.seals.length === 0 && <p className="text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center">Ton coffre est vide.</p>}
        {data.seals.map((seal: any) => (
          <div key={seal.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] flex justify-between items-center shadow-sm">
            <div>
              <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{seal.title}</div>
              <div className="text-xs text-[var(--text-muted)] font-mono mt-1">{new Date(seal.timestamp).toLocaleDateString('fr-FR')} • {seal.work_type || 'fichier'}</div>
            </div>
            <button onClick={async () => {
              if (!confirm("Supprimer cette œuvre ?")) return;
              const p = localStorage.getItem('sceau_pubkey');
              await fetch(`/api/seal/delete?id=${seal.id}&pubkey=${encodeURIComponent(p!)}`, { method: 'DELETE' });
              loadProfil();
            }} className="text-red-400 hover:text-red-600 p-2 text-xl">🗑️</button>
          </div>
        ))}
      </div>

    </div>
  );
}
