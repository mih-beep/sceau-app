'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PublicProfile() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [myHandle, setMyHandle] = useState<string | null>(null);

  useEffect(() => {
    setMyHandle(localStorage.getItem('sceau_handle'));
    if (params.handle) {
      fetch(`/api/user-profile/${params.handle}?viewer=${myHandle || ''}`)
        .then(r => r.json())
        .then(d => setData(d));
    }
  }, [params.handle, myHandle]);

  async function addFriend() {
    await fetch('/api/friends', { method: 'POST', body: JSON.stringify({ me: myHandle, target: data.handle }) });
    window.location.reload();
  }

  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4">
          {data.handle[0].toUpperCase()}
        </div>
        <h1 className="text-3xl font-bold font-serif">@{data.handle}</h1>
        
        {myHandle !== data.handle && (
          <div className="mt-4">
            {data.relationship === 'friend' && <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-bold text-sm">✅ Amis</span>}
            {data.relationship === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-sm">⏳ En attente</span>}
            {data.relationship === 'none' && <button onClick={addFriend} className="bg-[#E76F51] text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-[#F4A261]">Ajouter en ami</button>}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold font-serif mb-6 border-b border-[var(--border-color)] pb-2">Timeline</h2>
      <div className="space-y-4">
        {data.seals.map((seal: any) => (
          <div key={seal.id} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center gap-3">
            {seal.visibility === 'friends' && <span title="Amis uniquement">👥</span>}
            {seal.visibility === 'private' && <span title="Privé">🔒</span>}
            <div>
              <h3 className="text-lg font-bold">{seal.title}</h3>
              <div className="text-xs font-mono text-[var(--text-muted)] mt-1">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
