'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isLogged, setIsLogged] = useState(false);
  useEffect(() => { if (localStorage.getItem('sceau_handle')) setIsLogged(true); }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] font-sans">
      <nav className="w-full border-b border-[var(--border-color)] bg-[var(--bg-surface)] py-4 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-3xl font-bold font-serif text-[var(--text-main)]">SCEAU<span className="text-[#E76F51]">.</span></Link>
          <div className="flex items-center gap-4">
            {isLogged ? (
              <Link href="/feed" className="bg-[#1A1513] text-white px-6 py-2 rounded-xl font-bold text-sm">Mon espace</Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]">Se connecter</Link>
                <Link href="/signup" className="bg-[#E76F51] text-white px-6 py-2 rounded-xl font-bold text-sm">Créer un compte</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 leading-[1.1] text-[var(--text-main)]">
          Le web oublie.<br/>SCEAU <span className="text-[#E76F51] italic">se souvient.</span>
        </h1>
        <p className="text-lg md:text-xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto">
          Les sites changent en douce. Les IA inventent. SCEAU enregistre ce qui est affiché sur le web, à la seconde près, et le grave sur Bitcoin. Pour toujours.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup" className="bg-[#1A1513] text-white px-8 py-4 rounded-xl font-bold text-lg">Commencer à sceller</Link>
          <Link href="/verify" className="bg-[var(--bg-surface)] border text-[var(--text-main)] px-8 py-4 rounded-xl font-bold text-lg">Vérifier une preuve</Link>
        </div>
      </section>

      <section className="py-20 px-6 bg-[var(--bg-surface)] border-y">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Ce que SCEAU fait, concrètement.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border">
              <h3 className="text-xl font-bold mb-2">🤖 SCEAU Archive</h3>
              <p className="text-sm text-[var(--text-muted)]">Scanne les sites web, garde une copie de chaque version et détecte la moindre modification. Vous recevez une alerte avec la preuve.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border">
              <h3 className="text-xl font-bold mb-2">🧠 SCEAU Oracle</h3>
              <p className="text-sm text-[var(--text-muted)]">Une API qui fournit l'information vraie et en temps réel aux IA et aux robots. Plus d'hallucinations. Juste des faits prouvés.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border">
              <h3 className="text-xl font-bold mb-2">🤝 SCEAU Pacte</h3>
              <p className="text-sm text-[var(--text-muted)]">Un contrat numérique. Rédigez, ajoutez des fichiers, faites signer. Une fois toutes les signatures réunies, le pacte est scellé sur Bitcoin.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-8 rounded-2xl border">
              <h3 className="text-xl font-bold mb-2">💻 SCEAU AI (Local)</h3>
              <p className="text-sm text-[var(--text-muted)]">Une IA qui tourne sur votre ordinateur, connectée à SCEAU Oracle. Elle ne vous mentira jamais, et vos données restent chez vous.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 text-center border-t">
        <p className="text-sm text-[var(--text-muted)] font-mono">SCEAU © {new Date().getFullYear()} — Le notaire de poche.</p>
      </footer>
    </div>
  );
}
