'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isLogged, setIsLogged] = useState(false);

  useEffect(() => {
    const handle = localStorage.getItem('sceau_handle');
    if (handle) setIsLogged(true);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] font-sans">
      {/* Navigation */}
      <nav className="w-full border-b border-[var(--border-color)] bg-[var(--bg-surface)] py-4 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-3xl font-bold font-serif text-[var(--text-main)] tracking-tight">SCEAU<span className="text-[#E76F51]">.</span></Link>
          <div className="flex items-center gap-4">
            {isLogged ? (
              <Link href="/feed" className="bg-[#1A1513] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-black transition">Accéder à mon espace</Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition hidden sm:block">Se connecter</Link>
                <Link href="/signup" className="bg-[#E76F51] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-[#C75A22] transition">Créer un compte</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — Le Fait Brut */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-2 bg-white border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-mono font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
          L'infrastructure de preuve du web.
        </span>
        <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 leading-[1.1] tracking-tight text-[var(--text-main)]">
          Le web oublie.<br/>SCEAU <span className="text-[#E76F51] italic">se souvient.</span>
        </h1>
        <p className="text-lg md:text-xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
          Les sites changent en douce. Les IA inventent. SCEAU enregistre ce qui est affiché sur le web, à la seconde près, et le grave sur Bitcoin. Pour toujours.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup" className="bg-[#1A1513] text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-black transition">Commencer à sceller</Link>
          <Link href="/verify" className="bg-[var(--bg-surface)] border border-[var(--border-soft)] text-[var(--text-main)] px-8 py-4 rounded-xl font-bold text-lg hover:border-[#E76F51] transition">Vérifier une preuve</Link>
        </div>
      </section>

      {/* Les 4 Piliers — Ce que fait SCEAU */}
      <section className="py-20 px-6 bg-[var(--bg-surface)] border-y border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-serif text-[var(--text-main)] mb-4">Ce que SCEAU fait, concrètement.</h2>
            <p className="text-[var(--text-muted)]">Quatre outils. Une seule promesse : la preuve.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Archive */}
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border border-[var(--border-color)]">
              <div className="text-3xl mb-4">🤖</div>
              <h3 className="text-xl font-bold mb-2 text-[var(--text-main)]">SCEAU Archive</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                SCEAU Archive est le veilleur. Il scanne les sites web, garde une copie de chaque version et détecte la moindre modification (un prix, une clause, un article supprimé). Vous recevez une alerte avec la preuve cryptographique.
              </p>
            </div>

            {/* Oracle */}
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border border-[var(--border-color)]">
              <div className="text-3xl mb-4">🧠</div>
              <h3 className="text-xl font-bold mb-2 text-[var(--text-main)]">SCEAU Oracle</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                SCEAU Oracle est le cerveau pour les machines. C'est une API qui fournit l'information vraie, nettoyée et en temps réel aux IA, aux robots et aux algorithmes. Plus d'hallucinations. Juste des faits prouvés.
              </p>
            </div>

            {/* Pacte */}
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border border-[var(--border-color)]">
              <div className="text-3xl mb-4">🤝</div>
              <h3 className="text-xl font-bold mb-2 text-[var(--text-main)]">SCEAU Pacte</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                SCEAU Pacte est un contrat numérique. Rédigez un accord, ajoutez-y des fichiers, et faites-le signer par plusieurs personnes. Une fois toutes les signatures réunies, le pacte est scellé sur Bitcoin. Inviolable.
              </p>
            </div>

            {/* AI Locale */}
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border border-[var(--border-color)]">
              <div className="text-3xl mb-4">💻</div>
              <h3 className="text-xl font-bold mb-2 text-[var(--text-main)]">SCEAU AI (Local)</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Téléchargez une intelligence artificielle qui tourne sur votre propre ordinateur. Elle ne connaît pas le web par cœur, mais elle est connectée à SCEAU Oracle en permanence. Elle ne vous mentira jamais, et vos données restent chez vous.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Manifeste — Ce que SCEAU n'est pas */}
      <section className="py-24 px-6 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold font-serif text-[var(--text-main)] mb-8">Ce que SCEAU n'est pas.</h2>
        <div className="space-y-6 text-lg text-[var(--text-muted)]">
          <p>
            SCEAU <strong>n'est pas un juge</strong>. Il ne dit pas si une information est vraie ou fausse. Il prouve, cryptographiquement, ce qui était affiché sur un site à un instant T.
          </p>
          <p>
            SCEAU <strong>n'est pas un réseau social</strong>. C'est un outil de travail, un notaire de poche, une infrastructure de confiance.
          </p>
          <p>
            SCEAU <strong>ne lit pas vos données privées</strong>. Vos messages et vos pactes sont chiffrés de bout en bout. Même nous, nous ne pouvons pas les lire.
          </p>
        </div>
        <div className="mt-12">
          <Link href="/signup" className="inline-block bg-[#E76F51] text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[#C75A22] transition">
            Créer ma première preuve
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] py-12 text-center">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[var(--text-muted)] font-mono">SCEAU © {new Date().getFullYear()} — Le notaire de poche du web.</p>
          <div className="flex gap-4 text-sm font-bold">
            <Link href="/legal" className="text-[var(--text-muted)] hover:text-[var(--text-main)]">Mentions légales</Link>
            <Link href="/verify" className="text-[var(--text-muted)] hover:text-[var(--text-main)]">Vérifier une preuve</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
