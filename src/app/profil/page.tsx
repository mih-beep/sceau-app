'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  async function loadProfil() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.push('/login'); return; }
    
    const res = await fetch(`/api/profil?pubkey=${pubkey}`);
    const d = await res.json();
    
    if (res.ok && d.handle) {
      setData(d);
      if (d.recovery_email) setRecoveryEmail(d.recovery_email);
    } else {
      setError("Profil introuvable. Déconnecte-toi et reconnecte-toi.");
    }
  }

  useEffect(() => { loadProfil(); }, [router]);

  async function deleteSeal(id: string) {
    if (!confirm("Supprimer cette œuvre ? (La preuve restera dans Bitcoin, mais elle disparaîtra de l'app).")) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch(`/api/seal/delete?id=${id}&pubkey=${pubkey}`, { method: 'DELETE' });
    loadProfil();
  }

  async function saveRecoveryEmail() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/profil/update', { method: 'POST', body: JSON.stringify({ pubkey, recovery_email: recoveryEmail }) });
    setSaveStatus("✅ Sauvegardé !");
    setTimeout(() => setSaveStatus(''), 2000);
  }

  if (error) return (
    <div className="p-10 text-center font-mono">
      <p className="text-red-500 font-bold mb-4">{error}</p>
      <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="bg-[#E76F51] text-white px-4 py-2 rounded-xl">Se déconnecter</button>
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
          <div className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)] mt-1">Œuvres Scellées</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.hosted}</div>
          <div className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)] mt-1">Fichiers Hébergés</div>
        </div>
      </div>

      {/* Sécurité */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl mb-8 shadow-sm">
        <h2 className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>🛡️ Sécurité</h2>
        <p className="text-sm mb-4 text-[var(--text-muted)]">Ajoute un email de récupération au cas où tu oublierais ton mot de passe.</p>
        <div className="flex gap-2">
          <input type="email" placeholder="email@recovery.com" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} className="flex-1 border-2 border-[var(--border-color)] p-3 rounded-xl text-sm outline-none bg-transparent" style={{color: 'var(--text-main)'}} />
          <button onClick={saveRecoveryEmail} className="bg-[#E76F51] text-white px-6 py-3 rounded-xl font-bold text-sm">Sauver</button>
        </div>
        {saveStatus && <p className="mt-2 text-sm font-bold text-[#5D7A3A]">{saveStatus}</p>}
      </div>

      {/* Mes œuvres */}
      <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>📚 Mon Coffre</h2>
      <div className="space-y-3">
        {data.seals.length === 0 && <p className="text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center">Ton coffre est vide.</p>}
        
        {data.seals.map((seal: any) => (
          <div key={seal.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] flex justify-between items-center shadow-sm hover:shadow-md transition">
            <div>
              <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{seal.title}</div>
              <div className="text-xs text-[var(--text-muted)] font-mono mt-1">
                {new Date(seal.timestamp).toLocaleDateString('fr-FR')} • {seal.is_hosted ? 'Hébergé' : 'Preuve seule'}
              </div>
            </div>
            <button onClick={() => deleteSeal(seal.id)} className="text-red-400 hover:text-red-600 p-2 text-xl" title="Supprimer de l'app">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}
