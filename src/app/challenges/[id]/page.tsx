'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ChallengeDetail() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const load = () => {
    if (params.id) {
      fetch(`/api/challenges/${params.id}`).then(r => r.json()).then(d => {
        if (d.error) setError(d.error); else setData(d);
      });
    }
  };

  useEffect(() => { load(); }, [params.id]);

  async function vote(entryId: string) {
    if (!myPubkey) return alert("Connecte-toi pour voter !");
    const res = await fetch('/api/challenges/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: params.id, entry_id: entryId, pubkey: myPubkey })
    });
    const d = await res.json();
    if (!res.ok) alert(d.error);
    else { alert("Vote enregistré !"); load(); }
  }

  if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement du défi...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <Link href="/challenges" className="text-sm font-bold text-[#A89070] mb-4 inline-block hover:underline">← Retour aux défis</Link>
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{color: 'var(--text-main)'}}>{data.challenge.title}</h1>
        <p className="text-sm italic text-[var(--text-muted)]">{data.challenge.description}</p>
        <div className="mt-2 text-xs font-mono font-bold text-[#E76F51]">
          Fin le {new Date(data.challenge.deadline).toLocaleDateString('fr-FR')}
        </div>
      </div>

      <div className="grid gap-4">
        {data.entries.map((entry: any) => (
          <div key={entry.entry_id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <h3 className="font-bold text-lg" style={{color: 'var(--text-main)'}}>{entry.title}</h3>
              <p className="text-xs text-[var(--text-muted)]">Par @{entry.author}</p>
              {entry.file_path && (
                 <a href={entry.file_path} target="_blank" className="text-xs text-[#4A90C2] font-bold hover:underline mt-2 block">Voir l'œuvre ↗</a>
              )}
            </div>
            <div className="text-center">
              <button onClick={() => vote(entry.entry_id)} className="bg-[#FCEAD6] text-[#C44A2E] border border-[#F4D0A8] px-4 py-2 rounded-xl font-bold hover:bg-[#FCE0D6] transition">
                Voter
              </button>
              <div className="text-xs font-mono font-bold text-[var(--text-muted)] mt-2">{entry.votes} votes</div>
            </div>
          </div>
        ))}
        {data.entries.length === 0 && <p className="text-center italic text-[var(--text-muted)]">Personne n'a encore participé.</p>}
      </div>
    </div>
  );
}
