#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "Création de la Landing Page Publique (Next.js)"

cat > src/app/page.tsx << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [latestSeals, setLatestSeals] = useState<any[]>([]);
  const [isLogged, setIsLogged] = useState(false);

  useEffect(() => {
    // Vérifier si connecté
    const handle = localStorage.getItem('sceau_handle');
    if (handle) setIsLogged(true);

    // Récupérer les 3 dernières œuvres pour la preuve sociale
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => setLatestSeals((data.seals || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] font-sans">
      
      {/* NAV BAR PUBLIQUE */}
      <nav className="w-full border-b border-[var(--border-color)] bg-[var(--bg-surface)] py-4 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-3xl font-bold font-serif text-[var(--text-main)] tracking-tight">
            SCEAU<span className="text-[#E76F51]">.</span>
          </Link>
          <div className="flex items-center gap-4">
            {isLogged ? (
              <Link href="/feed" className="bg-[#1A1513] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-black transition">
                Accéder à mon espace
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition hidden sm:block">
                  Se connecter
                </Link>
                <Link href="/signup" className="bg-[#E76F51] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-[#C75A22] transition">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-2 bg-white border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-mono font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          L'infrastructure de preuve du 21ème siècle
        </span>
        <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 leading-[1.1] tracking-tight text-[var(--text-main)]">
          Prouvez que vous l'avez<br/>
          créé <span className="text-[#E76F51] italic">en premier.</span>
        </h1>
        <p className="text-lg md:text-xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
          SCEAU est le protocole universel de preuve. Scellez vos fichiers, vos contrats et vos idées en un clic. La preuve est gravée sur la blockchain Bitcoin. Pour toujours.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup" className="bg-[#1A1513] text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-black transition">
            Sceller mon premier fichier
          </Link>
          <Link href="/verify" className="bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] px-8 py-4 rounded-xl font-bold text-lg hover:border-[#E76F51] transition">
            Vérifier une preuve
          </Link>
        </div>
      </section>

      {/* À QUI S'ADRESSE SCEAU */}
      <section className="py-20 px-6 bg-[var(--bg-surface)] border-y border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-serif text-[var(--text-main)] mb-4">Un bouclier pour chaque créateur.</h2>
            <p className="text-[var(--text-muted)] max-w-2xl mx-auto">Que vous soyez seul ou une institution, SCEAU s'adapte à vos besoins de preuve et de confiance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Freelances & Créatifs</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Ne vous faites plus voler vos livrables. Prouvez l'antériorité de vos designs, codes ou textes face aux clients indélicats.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Entreprises & Agences</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Sécurisez vos contrats (Pactes) et votre code. Utilisez notre plugin GitHub pour sceller automatiquement chaque commit.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Institutions & Journalistes</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Archivez la vérité. Détectez les modifications de sites web avec SCEAU Archive et prouvez l'intégrité de vos dossiers.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Grand Public</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">Scellez vos souvenirs, créez des capsules temporelles pour vos proches, ou faites des "tope là" numériques avec des Pactes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* LA PUISSANCE DU PRODUIT */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          
          <div>
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-[var(--text-main)] mb-6">La complexité est cachée.<br/>La preuve est éternelle.</h2>
            <p className="text-[var(--text-muted)] mb-6 text-lg">
              Derrière SCEAU, il y a de la cryptographie de niveau militaire (SHA-256, Arbres de Merkle). 
              Devant, c'est aussi simple qu'un clic.
            </p>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="text-[#E76F51] font-bold text-xl">✓</div>
                <div>
                  <h4 className="font-bold text-[var(--text-main)]">L'Atelier (Zéro friction)</h4>
                  <p className="text-sm text-[var(--text-muted)]">Glissez un fichier, l'empreinte est gravée sur Bitcoin en 2 secondes.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="text-[#E76F51] font-bold text-xl">✓</div>
                <div>
                  <h4 className="font-bold text-[var(--text-main)]">Les Pactes (Le "Tope là" numérique)</h4>
                  <p className="text-sm text-[var(--text-muted)]">Un contrat multi-signatures inaltérable. Idéal pour les associés, les clients ou les promesses.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="text-[#E76F51] font-bold text-xl">✓</div>
                <div>
                  <h4 className="font-bold text-[var(--text-main)]">Le Dossier Miroir (Git de la Preuve)</h4>
                  <p className="text-sm text-[var(--text-muted)]">Scellez des versions (V1, V2) et voyez visuellement ce qui a été modifié (Vert/Orange/Rouge).</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-[#1A1513] p-8 rounded-3xl shadow-2xl relative">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#E76F51] rounded-full blur-[80px] opacity-20"></div>
             <h3 className="text-white font-mono text-sm mb-4">Preuve en direct</h3>
             <div className="bg-[#2A2421] rounded-xl p-4 mb-4">
                <p className="text-[#EADFD4] text-sm">Hash SHA-256</p>
                <p className="text-[#8A7A72] text-xs font-mono break-all mt-1">b2e74a9d1f0e8c6a5b3d2c1...</p>
             </div>
             <div className="flex items-center gap-2 text-green-400 text-xs font-bold font-mono">
               <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
               Ancré sur la blockchain Bitcoin
             </div>
          </div>
        </div>
      </section>

      {/* PREUVE SOCIALE (Dernières œuvres scellées) */}
      {latestSeals.length > 0 && (
        <section className="py-20 px-6 bg-[var(--bg-surface)] border-t border-[var(--border-color)]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold font-serif text-[var(--text-main)] mb-2">Dernières preuves gravées sur le réseau</h2>
              <p className="text-[var(--text-muted)] text-sm">Rejoignez les créateurs qui protègent leur génie.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestSeals.map((seal, i) => (
                <Link href={`/o/${seal.id}`} key={i} className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:border-[#E76F51] transition text-left block group">
                  <h3 className="font-bold text-lg truncate mb-2 group-hover:text-[#E76F51] transition text-[var(--text-main)]">{seal.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">Par @{seal.author}</p>
                  <p className="text-[0.65rem] text-[var(--text-muted)] mt-4 uppercase tracking-wider">Scellé le {new Date(seal.timestamp).toLocaleDateString('fr-FR')}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold font-serif text-[var(--text-main)] mb-6">
          Le web de demain sera un web de preuve.
        </h2>
        <p className="text-lg text-[var(--text-muted)] max-w-2xl mx-auto mb-10">
          "Dormez tranquilles. On gère le temps pour vous."
        </p>
        <Link href="/signup" className="inline-block bg-[#E76F51] text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[#C75A22] transition">
          Rejoindre SCEAU gratuitement
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] py-8 text-center">
        <p className="text-sm text-[var(--text-muted)] font-mono">
          SCEAU © {new Date().getFullYear()} — Le notaire de poche du web.
        </p>
      </footer>

    </div>
  );
}
EOF

say "Nettoyage du cache et build..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ La Landing Page publique est prête !${NC}"
