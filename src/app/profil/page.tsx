'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  async function loadProfil() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.push('/login'); return; }
    const res = await fetch(`/api/profil?pubkey=${pubkey}`);
    const d = await res.json();
    setData(d);
  }

  useEffect(() => { loadProfil(); }, [router]);

  async function deleteSeal(id: string) {
    if (!confirm("Supprimer cette œuvre ? (La preuve cryptographique restera dans Bitcoin, mais l'œuvre disparaîtra de l'app).")) return;
    
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch(`/api/seal/delete?id=${id}&pubkey=${pubkey}`, { method: 'DELETE' });
    loadProfil(); // Recharge la page
  }

  if (!data) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4">
          {data.handle[0].toUpperCase()}
        </div>
        <h1 className="text-3xl font-bold font-serif">@{data.handle}</h1>
      </div>

      <div className="flex bg-[#FDF8F0] border border-[#EFE0CA] p-6 rounded-xl justify-around mb-8">
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.sealed}</div>
          <div className="text-[0.65rem] font-mono uppercase text-[#A89070] mt-1">Scellés</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-[#E76F51]">{data.hosted}</div>
          <div className="text-[0.65rem] font-mono uppercase text-[#A89070] mt-1">Hébergés</div>
        </div>
      </div>

      <h2 className="text-xl font-bold font-serif mb-4">Mes œuvres</h2>
      <div className="space-y-3">
        {data.seals.length === 0 && <p className="text-[#A89070] italic text-sm">Tu n'as rien scellé pour l'instant.</p>}
        
        {data.seals.map((seal: any) => (
          <div key={seal.id} className="bg-white p-4 rounded-xl border border-[#EFE0CA] flex justify-between items-center">
            <div>
              <div className="font-bold text-[#2C1810]">{seal.title}</div>
              <div className="text-xs text-[#A89070] font-mono">{new Date(seal.timestamp).toLocaleDateString('fr-FR')} • {seal.is_hosted ? 'Hébergé' : 'Preuve seule'}</div>
            </div>
            <button onClick={() => deleteSeal(seal.id)} className="text-red-400 hover:text-red-600 p-2">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}
