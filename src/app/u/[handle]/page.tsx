'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PublicProfile() {
  const params = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (params.handle) {
      fetch(`/api/user-profile/${params.handle}`).then(r => r.json()).then(d => setData(d));
    }
  }, [params.handle]);

  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (data.error) return <div className="p-10 text-center font-mono">{data.error}</div>;

  return (
    <div className="p-6">
      <div className="text-center mb-10">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4">
          {data.handle[0].toUpperCase()}
        </div>
        <h1 className="text-3xl font-bold font-serif">@{data.handle}</h1>
        <p className="text-sm font-mono text-[var(--text-muted)]">Profil Public</p>
      </div>

      <h2 className="text-xl font-bold font-serif mb-6 border-b border-[var(--border-color)] pb-2">Timeline</h2>
      
      <div className="border-l-2 border-[var(--border-color)] pl-6 space-y-8 ml-4">
        {data.seals.map((seal: any) => (
          <div key={seal.id} className="relative">
            <div className="absolute -left-[31px] top-2 w-3 h-3 rounded-full bg-[#E76F51]"></div>
            <div className="text-sm font-mono text-[var(--text-muted)] mb-1">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div>
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
              <h3 className="text-lg font-bold">{seal.title}</h3>
              {seal.description && <p className="text-sm italic opacity-80 mt-1">{seal.description}</p>}
              {seal.is_hosted && <span className="inline-block mt-2 text-xs bg-[#F5F9EE] text-[#5D7A3A] px-2 py-1 rounded">📁 Fichier hébergé</span>}
            </div>
          </div>
        ))}
        {data.seals.length === 0 && <p className="text-[var(--text-muted)] italic">Aucune œuvre publique.</p>}
      </div>
    </div>
  );
}
