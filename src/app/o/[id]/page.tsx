'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function PublicSealPage() {
  const params = useParams();
  const [seal, setSeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/o/${params.id}`).then(r => r.json()).then(d => {
        if (d.seal) setSeal(d.seal);
        setLoading(false);
      });
    }
  }, [params.id]);

  if (loading) return <div className="p-10 text-center font-mono">Chargement de l'œuvre...</div>;
  if (!seal) return <div className="p-10 text-center font-mono text-red-500">Œuvre introuvable ou privée.</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 font-serif">
      
      <div className="w-full max-w-xl bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-color)] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#E76F51] to-[#F4A261]"></div>
        
        <div className="text-center mb-6">
          <span className="inline-block bg-[#FDF8F0] border border-[#EFE0CA] text-[#A89070] text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
            Preuve d'antériorité
          </span>
          <h1 className="text-4xl font-black mb-2" style={{color: 'var(--text-main)'}}>{seal.title}</h1>
          <p className="text-[var(--text-muted)]">Créé par <Link href={`/u/${seal.author}`} className="font-bold text-[#E76F51] hover:underline">@{seal.author}</Link></p>
        </div>

        {seal.description && <p className="text-center italic mb-6 opacity-80" style={{color: 'var(--text-main)'}}>"{seal.description}"</p>}

        <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6 text-center">
          <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">Empreinte cryptographique (SHA-256)</p>
          <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{seal.hash}</p>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-2">Scellé le {new Date(seal.timestamp).toLocaleString('fr-FR')}</p>
        </div>

        {seal.is_hosted && seal.file_path && (
          <a href={seal.file_path} target="_blank" className="block w-full text-center bg-[var(--text-main)] text-[var(--bg-surface)] py-3 rounded-xl font-bold shadow-md hover:opacity-80 transition mb-6">
            📂 Découvrir l'œuvre originale
          </a>
        )}

        <div className="border-t border-[var(--border-color)] pt-6 mt-6 text-center">
          <p className="text-sm mb-4" style={{color: 'var(--text-main)'}}>Tu as toi aussi une œuvre à protéger ?</p>
          <Link href="/seal" className="inline-block bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            Sceller mon œuvre gratuitement
          </Link>
        </div>
      </div>
    </div>
  );
}
