'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function PublicProfile() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myHandle, setMyHandle] = useState<string | null>(null);

  useEffect(() => {
    const h = localStorage.getItem('sceau_handle');
    setMyHandle(h);
    if (params.handle) {
      fetch(`/api/user-profile/${params.handle}?viewer=${h || ''}`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [params.handle]);

  async function addFriend() {
    if (!myHandle) return alert("Connectez-vous pour ajouter un ami.");
    await fetch('/api/friends', { method: 'POST', body: JSON.stringify({ me: myHandle, target: data.handle }) });
    alert(`Demande envoyée à @${data.handle} !`);
    window.location.reload();
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (data?.error) return <div className="p-10 text-center text-red-500">{data.error}</div>;

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'Art': return 'border-[#E9C46A] bg-[#FDF8F0]';
      case 'Musique': return 'border-[#4A90C2] bg-[#F0F6FC]';
      case 'Code': return 'border-[#2A9D8F] bg-[#F0F9F7]';
      case 'Écrit': return 'border-[#A78BC8] bg-[#F5F0FA]';
      default: return 'border-[var(--border-color)] bg-[var(--bg-surface)]';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-32 font-sans">
      {/* Hero Section */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] pt-16 pb-12 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#E76F51] to-[#F4A261]"></div>
        
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-4xl mx-auto mb-6 shadow-xl">
          {data.handle[0].toUpperCase()}
        </div>
        
        <h1 className="text-4xl font-bold mb-2" style={{color: 'var(--text-main)'}}>@{data.handle}</h1>
        {data.open_to_collaboration && (
          <span className="inline-block mt-2 bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] px-3 py-1 rounded-full text-xs font-bold">
            🤝 Ouvert aux collaborations
          </span>
        )}
        <p className="text-sm font-mono text-[var(--text-muted)] mt-2">{data.role || 'Créateur sur SCEAU'}</p>
        
        {myHandle !== data.handle && (
          <div className="mt-6">
            {data.relationship === 'friend' && <span className="bg-green-100 text-green-800 px-6 py-2 rounded-xl font-bold text-sm">✅ Amis</span>}
            {data.relationship === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-6 py-2 rounded-xl font-bold text-sm">⏳ En attente</span>}
            {data.relationship === 'none' && <button onClick={addFriend} className="bg-[#E76F51] text-white px-8 py-2 rounded-xl font-bold shadow-md hover:bg-[#F4A261] transition">+ Ajouter à mon cercle</button>}
          </div>
        )}
      </div>

      {/* Portfolio Grid */}
      <div className="max-w-5xl mx-auto px-6 mt-12">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{color: 'var(--text-main)'}}>
          🖼️ Galerie Publique <span className="text-sm font-normal text-[var(--text-muted)]">({data.seals.length} œuvres)</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.seals.map((seal: any) => (
            <Link href={`/o/${seal.id}`} key={seal.id} className={`block p-5 rounded-2xl border-2 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-200 ${getCategoryStyle(seal.category)}`}>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono font-bold italic opacity-60" style={{color: 'var(--text-main)'}}>{seal.category}</span>
                {seal.is_hosted ? <span title="Fichier hébergé">📁</span> : <span title="Preuve seule">🔒</span>}
              </div>
              <h3 className="font-bold text-lg mb-2 leading-tight" style={{color: 'var(--text-main)'}}>{seal.title}</h3>
              {seal.description && <p className="text-xs italic opacity-70 line-clamp-2 mb-3" style={{color: 'var(--text-main)'}}>"{seal.description}"</p>}
              <div className="text-[0.65rem] font-mono opacity-50 border-t border-black/5 pt-2 mt-auto" style={{color: 'var(--text-main)'}}>
                Scellé le {new Date(seal.timestamp).toLocaleDateString('fr-FR')}
              </div>
            </Link>
          ))}
          {data.seals.length === 0 && (
            <div className="col-span-full text-center py-16 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)]">
              <p className="text-[var(--text-muted)] italic">Ce créateur n'a pas encore publié d'œuvre publique.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
