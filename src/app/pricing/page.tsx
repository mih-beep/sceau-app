'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  // Simulation de l'appel à Stripe
  const handleSubscribe = (plan: string) => {
    alert(`Redirection vers Stripe pour l'offre ${plan}.\n\n(La plomberie s'occupera de générer le lien de paiement et de mettre à jour votre compte en PRO).`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] py-12 px-4 font-serif">
      
      {/* En-tête */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{color: 'var(--text-main)'}}>
          Protégez ce que vous créez. <br/><span className="text-[#E76F51] italic">Dormez tranquille.</span>
        </h1>
        <p className="text-lg text-[var(--text-muted)] italic mb-8">
          Que vous soyez un artiste indépendant, un freelance ou une entreprise, SCEAU a une offre pour vous.
        </p>

        {/* Toggle Mensuel / Annuel */}
        <div className="flex items-center justify-center gap-3 bg-[var(--bg-surface)] w-fit mx-auto p-1 rounded-xl border border-[var(--border-color)]">
          <button 
            onClick={() => setIsAnnual(false)} 
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${!isAnnual ? 'bg-[#E76F51] text-white shadow' : 'text-[var(--text-muted)]'}`}
          >
            Mensuel
          </button>
          <button 
            onClick={() => setIsAnnual(true)} 
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${isAnnual ? 'bg-[#E76F51] text-white shadow' : 'text-[var(--text-muted)]'}`}
          >
            Annuel <span className="text-[0.6rem] bg-green-500 text-white px-2 py-0.5 rounded-full">2 mois offerts</span>
          </button>
        </div>
      </div>

      {/* Grille des Prix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        
        {/* OFFRE FREE */}
        <div className="bg-[var(--bg-surface)] rounded-3xl p-8 border border-[var(--border-color)] shadow-sm flex flex-col h-full">
          <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Découverte</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6 h-10">Pour tester le pouvoir de la preuve.</p>
          <div className="text-4xl font-bold mb-6" style={{color: 'var(--text-main)'}}>0€<span className="text-sm font-normal text-[var(--text-muted)]">/mois</span></div>
          
          <ul className="space-y-3 mb-8 flex-1 text-sm">
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> 100 Mo de stockage (Cloud)</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Scellement manuel (SHA-256)</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Feed public & Timeline</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Certificat PDF basique</li>
            <li className="flex items-center gap-2 text-[var(--text-muted)] opacity-50"><span className="text-red-400 font-bold">✗</span> Dossier Miroir & Versions</li>
            <li className="flex items-center gap-2 text-[var(--text-muted)] opacity-50"><span className="text-red-400 font-bold">✗</span> Journal des accès détaillé</li>
          </ul>
          
          <Link href="/signup" className="w-full block text-center bg-[var(--bg-main)] text-[var(--text-main)] py-3 rounded-xl font-bold border border-[var(--border-color)] hover:bg-[#FDF8F0] transition">
            Commencer gratuitement
          </Link>
        </div>

        {/* OFFRE PRO (Mise en avant) */}
        <div className="bg-[var(--text-main)] rounded-3xl p-8 border-2 border-[#E76F51] shadow-xl flex flex-col h-full relative transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#E76F51] text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-md">Le plus populaire</div>
          
          <h2 className="text-2xl font-bold mb-2 text-white">SCEAU PRO</h2>
          <p className="text-sm text-gray-400 mb-6 h-10">Pour les créateurs et freelances qui vivent de leur art.</p>
          <div className="text-4xl font-bold mb-6 text-white">
            {isAnnual ? '99€' : '9,99€'}<span className="text-sm font-normal text-gray-400">/{isAnnual ? 'an' : 'mois'}</span>
          </div>
          
          <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-200">
            <li className="flex items-center gap-2"><span className="text-[#E76F51] font-bold">✓</span> <strong>100 Go</strong> de stockage Cloud</li>
            <li className="flex items-center gap-2"><span className="text-[#E76F51] font-bold">✓</span> <strong>Dossier Miroir</strong> (Versions illimitées)</li>
            <li className="flex items-center gap-2"><span className="text-[#E76F51] font-bold">✓</span> <strong>Scellement automatique</strong> en arrière-plan</li>
            <li className="flex items-center gap-2"><span className="text-[#E76F51] font-bold">✓</span> <strong>Journal des accès PRO</strong> + Export PDF</li>
            <li className="flex items-center gap-2"><span className="text-[#E76F51] font-bold">✓</span> <strong>Portfolio PDF modulaire</strong> (sans filigrane)</li>
            <li className="flex items-center gap-2"><span className="text-[#E76F51] font-bold">✓</span> Chiffrement de bout en bout</li>
            <li className="flex items-center gap-2"><span className="text-[#E76F51] font-bold">✓</span> Badge URNE (Humain vérifié)</li>
          </ul>
          
          <button onClick={() => handleSubscribe('PRO')} className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold shadow-lg hover:bg-[#F4A261] transition">
            Passer à la vitesse supérieure
          </button>
        </div>

        {/* OFFRE BUSINESS */}
        <div className="bg-[var(--bg-surface)] rounded-3xl p-8 border border-[var(--border-color)] shadow-sm flex flex-col h-full">
          <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Business</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6 h-10">Pour les agences, PME et cabinets d'avocats.</p>
          <div className="text-4xl font-bold mb-6" style={{color: 'var(--text-main)'}}>
            {isAnnual ? '490€' : '49,99€'}<span className="text-sm font-normal text-[var(--text-muted)]">/{isAnnual ? 'an' : 'mois'}</span>
          </div>
          
          <ul className="space-y-3 mb-8 flex-1 text-sm">
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> <strong>1 To</strong> de stockage Cloud</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Tout ce qu'il y a dans PRO</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> <strong>Multi-utilisateurs</strong> (5 comptes)</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Certificats d'antériorité illimités</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Accès API & Intégrations sur-mesure</li>
            <li className="flex items-center gap-2"><span className="text-green-500 font-bold">✓</span> Support prioritaire dédié</li>
          </ul>
          
          <button onClick={() => handleSubscribe('BUSINESS')} className="w-full bg-[var(--bg-main)] text-[var(--text-main)] py-3 rounded-xl font-bold border border-[var(--border-color)] hover:bg-[#FDF8F0] transition">
            Contacter les ventes
          </button>
        </div>

      </div>

      {/* FAQ Rapide */}
      <div className="max-w-3xl mx-auto mt-20">
        <h3 className="text-2xl font-bold text-center mb-8" style={{color: 'var(--text-main)'}}>Questions fréquentes</h3>
        <div className="space-y-4">
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
            <h4 className="font-bold text-sm mb-1" style={{color: 'var(--text-main)'}}>Puis-je annuler à tout moment ?</h4>
            <p className="text-xs text-[var(--text-muted)]">Oui. Vous gardez l'accès à vos preuves (les hashs sont éternels), mais vous perdez les fonctionnalités avancées (Dossier Miroir, Journal PDF) à la fin du mois.</p>
          </div>
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
            <h4 className="font-bold text-sm mb-1" style={{color: 'var(--text-main)'}}>Que deviennent mes fichiers si j'arrête l'abonnement ?</h4>
            <p className="text-xs text-[var(--text-muted)]">Vous pouvez les télécharger à tout moment. Si vous dépassez les 100 Mo du compte gratuit, vous pourrez les stocker en local sur votre PC tout en gardant la preuve sur SCEAU.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
