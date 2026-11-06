'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Friends() {
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;

  const load = () => {
    if (myHandle) fetch(`/api/friends?me=${myHandle}`).then(r => r.json()).then(d => setData(d));
  };

  useEffect(() => { load(); }, [myHandle]);

  // Recherche d'utilisateurs (avec un petit délai pour ne pas spammer l'API)
  useEffect(() => {
    if (!searchQuery.trim() || !myHandle) { setSearchResults([]); return; }
    const delay = setTimeout(() => {
      fetch(`/api/friends?me=${myHandle}&search=${searchQuery}`)
        .then(r => r.json())
        .then(d => setSearchResults(d.searchResults || []));
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery, myHandle]);

  async function respond(target: string, action: string) {
    await fetch('/api/friends/respond', { method: 'POST', body: JSON.stringify({ me: myHandle, target, action }) });
    load();
  }

  async function addFriend(target: string) {
    await fetch('/api/friends', { method: 'POST', body: JSON.stringify({ me: myHandle, target }) });
    alert(`Demande envoyée à @${target}`);
    setSearchQuery('');
  }

  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <h1 className="text-3xl font-bold mb-6" style={{color: 'var(--text-main)'}}>Mon Cercle.</h1>
      
      {/* BARRE DE RECHERCHE */}
      <div className="mb-8">
        <input 
          type="text" 
          placeholder="🔍 Chercher un créateur par pseudo..." 
          className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl outline-none bg-[var(--bg-surface)]"
          style={{color: 'var(--text-main)'}}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="mt-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg absolute w-[calc(100%-3rem)] max-w-[calc(42rem-3rem)] z-10">
            {searchResults.map(u => (
              <div key={u.handle} className="flex justify-between items-center p-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-main)]">
                <div>
                  <Link href={`/u/${u.handle}`} className="font-bold hover:underline" style={{color: 'var(--text-main)'}}>@{u.handle}</Link>
                  <span className="text-xs text-[var(--text-muted)] ml-2">{u.role}</span>
                </div>
                <button onClick={() => addFriend(u.handle)} className="bg-[#E76F51] text-white px-3 py-1 rounded-lg text-xs font-bold">+ Ajouter</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DEMANDES REÇUES */}
      {data.received.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#E76F51] mb-3">Demandes en attente ({data.received.length})</h2>
          <div className="space-y-2">
            {data.received.map((r: any) => (
              <div key={r.handle} className="bg-[#FDF4F0] p-3 rounded-xl border border-[#FCE0D6] flex justify-between items-center">
                <Link href={`/u/${r.handle}`} className="font-bold hover:underline" style={{color: 'var(--text-main)'}}>@{r.handle}</Link>
                <div className="flex gap-2">
                  <button onClick={() => respond(r.handle, 'accept')} className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Accepter</button>
                  <button onClick={() => respond(r.handle, 'reject')} className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Refuser</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MES AMIS (Avec leur dernière œuvre) */}
      <h2 className="text-lg font-bold mb-3">Mes Amis ({data.friends.length})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.friends.map((f: any) => (
          <div key={f.handle} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <Link href={`/u/${f.handle}`} className="font-bold hover:underline" style={{color: 'var(--text-main)'}}>@{f.handle}</Link>
              <span className="text-xs bg-[#F5F9EE] text-[#5D7A3A] px-2 py-1 rounded">Ami</span>
            </div>
            {f.last_seal ? (
              <Link href={`/o/${f.last_seal_id}`} className="block text-xs text-[var(--text-muted)] bg-[var(--bg-main)] p-2 rounded border border-[var(--border-color)] hover:border-[#E76F51] transition">
                Dernière œuvre : <span className="font-bold" style={{color: 'var(--text-main)'}}>"{f.last_seal}"</span>
              </Link>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">Aucune œuvre publique récente.</p>
            )}
          </div>
        ))}
        {data.friends.length === 0 && <p className="text-sm text-[var(--text-muted)] italic col-span-2 text-center py-4">Ton cercle est vide. Cherche des créateurs ci-dessus !</p>}
      </div>
    </div>
  );
}
