'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProjetsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;
    // On réutilise l'API profil qui renvoie les projets (ou on crée une API dédiée)
    // Ici, simulation avec un fetch sur une route à créer si besoin
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-serif text-[var(--text-main)]">Mes Projets (Merkle)</h1>
        <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-xl font-bold text-sm">+ Nouveau Projet</Link>
      </div>
      
      <div className="bg-white p-10 rounded-2xl border text-center">
        <p className="text-gray-500 italic">La liste de vos dossiers miroirs s'affichera ici.</p>
      </div>
    </div>
  );
}
