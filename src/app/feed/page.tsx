'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => {
        // SÉCURITÉ : On vérifie que c'est bien une liste
        if (data.seals && Array.isArray(data.seals)) {
          setSeals(data.seals);
        } else {
          setSeals([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setSeals([]);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-[#F5E9D8] text-[#2C1810] p-6 font-serif">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b-2 border-[#E8D5B8] pb-6">
          <h1 className="text-4xl font-black">SCEAU<span className="text-[#E76F51] italic">.</span></h1>
          <div className="flex gap-4 font-mono text-sm font-bold">
            <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg hover:bg-[#F4A261] transition">Sceller</Link>
            <Link href="/verify" className="bg-white border border-[#E8D5B8] px-4 py-2 rounded-lg hover:bg-gray-50 transition">Vérifier</Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center font-mono">Chargement des preuves...</p>
        ) : seals.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-[#E8D5B8]">
            <p className="text-xl mb-4">Aucune création scellée pour l'instant.</p>
            <Link href="/seal" className="text-[#E76F51] font-bold underline">Sois le premier à sceller une œuvre.</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {seals.map((seal) => (
              <div key={seal.id} className="bg-white p-6 rounded-2xl border border-[#E8D5B8] shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-2xl font-bold">{seal.title}</h2>
                  <span className="text-xs font-mono bg-[#F0F9F7] text-[#1E7A70] px-2 py-1 rounded">Preuve d'antériorité</span>
                </div>
                <p className="text-sm text-[#7A5A3A] mb-4">
                  Par <span className="font-bold text-[#2C1810]">@{seal.handle}</span> le {new Date(seal.timestamp).toLocaleDateString('fr-FR')}
                </p>
                <div className="flex items-center gap-2 text-xs font-mono text-[#A89070] bg-[#FDF8F0] p-2 rounded">
                  <span>Hash : {seal.id.slice(0, 16)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
