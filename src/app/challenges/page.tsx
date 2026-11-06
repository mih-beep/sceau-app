'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Challenges() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [isAnon, setIsAnon] = useState(false);

  const load = () => {
    fetch('/api/challenges/list').then(r => r.json()).then(d => {
      setChallenges(d.challenges || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  async function createChallenge() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert("Connecte-toi !");
    if (!title) return alert("Titre requis");

    const res = await fetch('/api/challenges/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc, pubkey, is_anonymous: isAnon })
    });
    if (res.ok) {
      setShowModal(false); setTitle(''); setDesc(''); load();
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>🏆 Défis de Preuve.</h1>
        <button onClick={() => setShowModal(true)} className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Créer un défi</button>
      </div>

      {loading ? <p className="text-center font-mono">Chargement...</p> : (
        <div className="grid gap-4">
          {challenges.map(c => (
            <Link href={`/challenges/${c.id}`} key={c.id} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition block">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>{c.title}</h2>
                {c.is_anonymous && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Anonyme</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-4">Lancé par @{c.creator}</p>
              <div className="flex justify-between items-center text-xs font-mono text-[#A89070]">
                <span>👥 {c.entries_count} participations</span>
                <span>⏱ Fin le {new Date(c.deadline).toLocaleDateString('fr-FR')}</span>
              </div>
            </Link>
          ))}
          {challenges.length === 0 && <p className="text-center italic text-[var(--text-muted)]">Aucun défi en cours.</p>}
        </div>
      )}

      {/* Modale de création */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Créer un Défi</h2>
            <input type="text" placeholder="Titre (ex: Meilleur design de l'été)" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={title} onChange={e => setTitle(e.target.value)} />
            <textarea placeholder="Description du défi..." className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={desc} onChange={e => setDesc(e.target.value)} />
            <label className="flex items-center gap-3 mb-6 cursor-pointer">
              <input type="checkbox" checked={isAnon} onChange={e => setIsAnon(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>Cacher les noms (Vote à l'aveugle)</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createChallenge} className="flex-1 bg-[#E76F51] text-white py-2 rounded-xl font-bold">Lancer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
