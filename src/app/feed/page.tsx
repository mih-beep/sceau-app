'use client';
import { useEffect, useState } from 'react';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => setSeals(data));
  }, []);

  return (
    <main className="p-10 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black">Réseau SCEAU</h1>
        <a href="/seal" className="bg-green-600 text-white px-4 py-2 rounded">Nouveau sceau</a>
      </div>

      <div className="space-y-4">
        {seals.map((seal) => (
          <div key={seal.id} className="border border-gray-300 p-4 rounded-lg bg-gray-50">
            <h2 className="text-xl font-bold text-black">{seal.title}</h2>
            <p className="text-sm text-gray-600">
              Créé par <span className="font-bold text-blue-600">@{seal.author}</span> le {new Date(seal.timestamp).toLocaleDateString('fr-FR')}
            </p>
            <p className="text-xs font-mono text-gray-400 mt-2">ID: {seal.id.slice(0,8)}</p>
          </div>
        ))}
        {seals.length === 0 && <p className="text-gray-500">Aucun sceau pour le moment.</p>}
      </div>
    </main>
  );
}
