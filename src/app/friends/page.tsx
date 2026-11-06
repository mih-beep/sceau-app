'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Friends() {
  const [data, setData] = useState<any>(null);
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;

  const load = () => {
    if (myHandle) fetch(`/api/friends?me=${myHandle}`).then(r => r.json()).then(d => setData(d));
  };

  useEffect(() => { load(); }, [myHandle]);

  async function respond(target: string, action: string) {
    await fetch('/api/friends/respond', { method: 'POST', body: JSON.stringify({ me: myHandle, target, action }) });
    load();
  }

  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <h1 className="text-3xl font-bold mb-6" style={{color: 'var(--text-main)'}}>Mon Cercle.</h1>
      
      {data.received.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#E76F51] mb-3">Demandes en attente ({data.received.length})</h2>
          <div className="space-y-2">
            {data.received.map((r: any) => (
              <div key={r.handle} className="bg-white p-3 rounded-xl border border-[var(--border-color)] flex justify-between items-center">
                <span className="font-bold">@{r.handle}</span>
                <div className="flex gap-2">
                  <button onClick={() => respond(r.handle, 'accept')} className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Accepter</button>
                  <button onClick={() => respond(r.handle, 'reject')} className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Refuser</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">Mes Amis ({data.friends.length})</h2>
      <div className="grid grid-cols-2 gap-3">
        {data.friends.map((f: any) => (
          <Link key={f.handle} href={`/u/${f.handle}`} className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition">
            <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>@{f.handle}</div>
          </Link>
        ))}
        {data.friends.length === 0 && <p className="text-sm text-[var(--text-muted)] italic col-span-2">Tu n'as pas encore d'amis.</p>}
      </div>
    </div>
  );
}
