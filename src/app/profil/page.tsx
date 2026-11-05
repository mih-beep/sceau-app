'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateCertificate } from '@/lib/pdf';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [githubUser, setGithubUser] = useState('');

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

  async function syncGithub() {
    if (!githubUser) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    const res = await fetch('/api/github/sync', { method: 'POST', body: JSON.stringify({ pubkey, github_username: githubUser }) });
    const d = await res.json();
    if (res.ok) { alert(`${d.commitsScelles} commits scellés !`); loadProfil(); }
  }

  function exportPortfolio() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;
    // On utilise la même fonction PDF, on pourrait l'adapter pour un portfolio complet
    generateCertificate(`Portfolio de @${data.handle}`, data.handle, new Date().toISOString(), "Lien vers toutes les œuvres", "");
  }

  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  const isActiveCreator = data.sealed >= 10;

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-lg">
          {data.handle[0].toUpperCase()}
        </div>
        <h1 className="text-4xl font-bold mb-1 flex items-center justify-center gap-2" style={{color: 'var(--text-main)'}}>
          @{data.handle}
          {isActiveCreator && <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-300" title="Créateur Actif">✔️ Actif</span>}
        </h1>
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

      <div className="flex gap-4 mb-8">
        <button onClick={exportPortfolio} className="flex-1 bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-sm">📄 Export Portfolio PDF</button>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl mb-8">
        <h3 className="font-bold mb-2">Lier mon GitHub (Commit Proof)</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Ton pseudo GitHub" className="flex-1 border-2 border-[var(--border-color)] p-2 rounded-xl bg-transparent text-sm" value={githubUser} onChange={e => setGithubUser(e.target.value)} />
          <button onClick={syncGithub} className="bg-[#2C1810] text-white px-4 py-2 rounded-xl text-sm font-bold">Synchroniser</button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">Scelle automatiquement tes derniers commits publics.</p>
      </div>

      <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📚 Mon Coffre</h2>
      <div className="space-y-3 mb-10">
        {data.seals.map((seal: any) => (
          <div key={seal.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] flex justify-between items-center shadow-sm">
            <div>
              <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{seal.title}</div>
              <div className="text-xs text-[var(--text-muted)] font-mono mt-1">{new Date(seal.timestamp).toLocaleDateString('fr-FR')} • {seal.work_type || 'fichier'}</div>
            </div>
            <button onClick={() => {/* fonction delete */}} className="text-red-400 hover:text-red-600 p-2 text-xl">🗑️</button>
          </div>
        ))}
      </div>

      <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="w-full py-4 text-red-500 font-bold border border-red-500 rounded-xl hover:bg-red-50 transition">Se déconnecter</button>
    </div>
  );
}
