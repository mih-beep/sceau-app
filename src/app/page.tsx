'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [latestSeals, setLatestSeals] = useState<any[]>([]);

  // On récupère les 3 dernières œuvres pour faire "preuve sociale"
  useEffect(() => {
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => setLatestSeals((data.seals || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden font-serif">
      
      {/* --- EFFETS DE FOND (Lumières) --- */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#E76F51] rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#4A90C2] rounded-full blur-[120px] opacity-20 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center justify-center pt-20 pb-12 px-6 text-center">
        
        {/* --- BADGE HAUT --- */}
        <span className="inline-flex items-center gap-2 bg-[#FFFCF7] border border-[#EFE0CA] text-[#A89070] text-[10px] sm:text-xs font-mono font-bold px-4 py-2 rounded-full uppercase tracking-widest mb-8 shadow-sm animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#7A9B5A] animate-pulse"></span>
          La couche de confiance du web
        </span>
        
        {/* --- TITRE PRINCIPAL --- */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.1] tracking-tight" style={{color: 'var(--text-main)'}}>
          Prouvez que vous l'avez<br/>
          créé <span className="text-[#E76F51] italic relative">
            en premier.
            <svg className="absolute w-full h-3 -bottom-1 left-0 text-[#E76F51] opacity-30" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent"/>
            </svg>
          </span>
        </h1>
        
        {/* --- SOUS-TITRE --- */}
        <p className="text-lg md:text-xl text-[#7A5A3A] max-w-2xl mx-auto mb-12 italic leading-relaxed">
          SCEAU est le premier réseau social où l'on ne dit pas, on prouve. <br className="hidden md:block"/>
          Scellez vos œuvres gratuitement, avant de les publier. La preuve existe. Pour toujours.
        </p>

        {/* --- BOUTONS D'ACTION --- */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-20 w-full max-w-md">
          <Link href="/seal" className="group relative bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition duration-300 overflow-hidden">
            <span className="relative z-10">Sceller une œuvre</span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition duration-300"></div>
          </Link>
          <Link href="/feed" className="bg-[#FFFCF7] border-2 border-[#EFE0CA] text-[#2C1810] px-8 py-4 rounded-2xl font-bold text-lg hover:border-[#E76F51] hover:bg-[#FDF8F0] transition duration-300">
            Explorer le réseau
          </Link>
        </div>

        {/* --- PREUVE SOCIALE EN DIRECT --- */}
        {latestSeals.length > 0 && (
          <div className="mb-24 w-full max-w-4xl">
            <p className="text-xs font-mono font-bold text-[#A89070] uppercase tracking-widest mb-6">Dernières preuves gravées</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {latestSeals.map((seal, i) => (
                <Link href={`/o/${seal.id}`} key={i} className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition text-left block">
                  <div className="text-xl mb-3">{seal.is_mystery ? '🔒' : '📜'}</div>
                  <h3 className="font-bold text-lg truncate mb-1" style={{color: 'var(--text-main)'}}>{seal.title}</h3>
                  <p className="text-xs text-[#A89070]">Par @{seal.author} • {new Date(seal.timestamp).toLocaleDateString('fr-FR')}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* --- LES 3 PILIERS --- */}
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {/* Pilier 1 */}
            <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm relative overflow-hidden group hover:border-[#E76F51] transition">
              <div className="w-12 h-12 bg-[#FCEAD6] rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">⚡</div>
              <h3 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>Zéro friction</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Glissez un fichier, tapez un texte, ou enregistrez un audio. En 1 clic, votre œuvre est protégée par une empreinte cryptographique.</p>
            </div>
            {/* Pilier 2 */}
            <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm relative overflow-hidden group hover:border-[#4A90C2] transition">
              <div className="w-12 h-12 bg-[#DCE8F5] rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">🔒</div>
              <h3 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>Preuve absolue</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Le hash SHA-256 est gravé dans le marbre numérique. Modifiez un seul mot, et l'empreinte change. C'est la fin de la loi du plus fort.</p>
            </div>
            {/* Pilier 3 */}
            <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm relative overflow-hidden group hover:border-[#7A9B5A] transition">
              <div className="w-12 h-12 bg-[#F5F9EE] rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">🌍</div>
              <h3 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>Réseau vivant</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Découvrez les créations du monde entier, ajoutez des amis, signez des pactes et construisez votre CV de preuves.</p>
            </div>
          </div>
        </div>

        {/* --- CITATION FINALE --- */}
        <div className="mt-24 max-w-3xl mx-auto border-t border-[var(--border-color)] pt-12">
          <p className="text-2xl md:text-3xl italic font-bold text-[#7A5A3A] leading-snug">
            "SCEAU ne réinvente pas la loi. <br/>Il lui donne des yeux."
          </p>
        </div>

      </div>
    </div>
  );
}
