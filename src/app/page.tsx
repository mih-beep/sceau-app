'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [latestSeals, setLatestSeals] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => setLatestSeals((data.seals || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-[var(--bg-main)]">
      
      {/* HERO */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-24 pb-16 px-6 text-center">
        
        <span className="inline-flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-mono font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          L'infrastructure de preuve du 21ème siècle
        </span>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.1] tracking-tight font-serif" style={{color: 'var(--text-main)'}}>
          Prouvez que vous l'avez<br/>
          créé <span className="text-[#E76F51] italic">en premier.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-12 leading-relaxed">
          SCEAU est le premier protocole qui permet à quiconque — freelance, entreprise ou institution — de certifier l'authenticité et l'antériorité d'une œuvre en un clic. La preuve est gravée sur Bitcoin. Pour toujours.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-24 w-full max-w-md">
          <Link href="/seal" className="bg-[#1A1513] text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-black transition duration-300">
            Sceller une œuvre
          </Link>
          <Link href="/feed" className="bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] px-8 py-4 rounded-xl font-bold text-lg hover:border-[#E76F51] transition duration-300">
            Explorer le réseau
          </Link>
        </div>

        {/* PREUVE SOCIALE (Dernières œuvres) */}
        {latestSeals.length > 0 && (
          <div className="mb-24 w-full max-w-5xl">
            <p className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6">Dernières preuves gravées sur le réseau</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestSeals.map((seal, i) => (
                <Link href={`/o/${seal.id}`} key={i} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:border-[#E76F51] transition text-left block group">
                  <h3 className="font-bold text-lg truncate mb-2 group-hover:text-[#E76F51] transition" style={{color: 'var(--text-main)'}}>{seal.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">Par @{seal.author}</p>
                  <p className="text-[0.65rem] text-[var(--text-muted)] mt-4 uppercase tracking-wider">Scellé le {new Date(seal.timestamp).toLocaleDateString('fr-FR')}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* LES 4 PILIERS (Ouverture Universelle) */}
        <div className="w-full max-w-5xl">
          <h2 className="text-3xl font-bold font-serif mb-12" style={{color: 'var(--text-main)'}}>Un bouclier pour chaque créateur.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            
            <div className="bg-[var(--bg-surface)] p-8 rounded-2xl border border-[var(--border-color)] shadow-sm">
              <h3 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>Pour les Freelances & Artistes</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Ne vous faites plus jamais voler vos livrables. Prouvez à vos clients que vous êtes l'auteur original de chaque version de votre travail (V1, V2, V3) grâce au Dossier Miroir.</p>
            </div>

            <div className="bg-[var(--bg-surface)] p-8 rounded-2xl border border-[var(--border-color)] shadow-sm">
              <h3 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>Pour les Entreprises & Agences</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Sécurisez vos contrats et vos codes sources. Utilisez les Pactes multi-signatures pour sceller des accords avec vos partenaires, et le Journal des Accès pour tracer qui a vu quoi.</p>
            </div>

            <div className="bg-[var(--bg-surface)] p-8 rounded-2xl border border-[var(--border-color)] shadow-sm">
              <h3 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>Pour les Institutions & Chercheurs</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Protégez vos brevets, thèses et archives. Notre API et notre mode local (Flash) vous permettent de prouver l'intégrité de millions de documents sans jamais les confier à un serveur tiers.</p>
            </div>

            <div className="bg-[var(--bg-surface)] p-8 rounded-2xl border border-[var(--border-color)] shadow-sm">
              <h3 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>Pour le Grand Public</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Scellez vos souvenirs, créez des capsules temporelles pour vos proches, ou prouvez votre bonne foi dans un simple litige grâce à nos certificats vérifiables par tous.</p>
            </div>

          </div>
        </div>

        {/* CITATION FINALE */}
        <div className="mt-24 max-w-3xl mx-auto border-t border-[var(--border-color)] pt-12">
          <p className="text-2xl md:text-3xl italic font-bold text-[#E76F51] leading-snug">
            "La justice a besoin d'yeux. <br/>SCEAU lui donne la vue."
          </p>
        </div>

      </div>
    </div>
  );
}
