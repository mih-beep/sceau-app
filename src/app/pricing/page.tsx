'use client';
import Link from 'next/link';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] py-16 px-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold font-serif mb-4" style={{color: 'var(--text-main)'}}>
            Le notaire de poche du web.
          </h1>
          <p className="text-lg text-[var(--text-muted)] max-w-2xl mx-auto">
            SCEAU est actuellement en phase de lancement. <strong>Toutes les fonctionnalités sont gratuites</strong> pour une durée limitée.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          {/* OFFRE FREE / ACTUELLE */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-8 border border-[var(--border-color)] shadow-sm flex flex-col items-center text-center">
            <h2 className="text-xl font-bold mb-2 text-[var(--text-main)]">Accès Anticipé</h2>
            <p className="text-sm text-[var(--text-muted)] mb-8">Toutes les fonctionnalités incluses.</p>
            <div className="text-5xl font-bold mb-8 text-[var(--text-main)]">0€</div>
            
            <ul className="text-sm text-[var(--text-muted)] mb-8 space-y-3 flex-1 text-left w-full max-w-xs mx-auto">
              <li>Preuve cryptographique illimitée</li>
              <li>Dossier Miroir (Arbre de Merkle)</li>
              <li>Journal des accès complet</li>
              <li>Messagerie & Pactes multi-signatures</li>
              <li>Certificats PDF officiels</li>
            </ul>
            
            <Link href="/seal" className="w-full block bg-[var(--text-main)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
              Commencer à sceller
            </Link>
          </div>

          {/* OFFRE PRO (Leurre) */}
          <div className="bg-[#1A1513] rounded-2xl p-8 border border-[#332824] shadow-xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#E76F51]"></div>
            <h2 className="text-xl font-bold mb-2 text-white">SCEAU PRO</h2>
            <p className="text-sm text-[#8A7A72] mb-8">Pour les professionnels exigeants.</p>
            <div className="text-5xl font-bold mb-8 text-white">9,99€<span className="text-sm font-normal text-[#8A7A72]">/mois</span></div>
            
            <div className="flex-1 flex items-end mb-8">
              <p className="text-xs text-[#8A7A72] italic">La tarification et les fonctionnalités PRO seront révélées à la fin de la période de lancement.</p>
            </div>
            
            <button 
              onClick={() => alert("Le pack SCEAU PRO sera disponible prochainement. Profitez de toutes les fonctionnalités gratuitement pour le moment.")}
              className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold hover:bg-[#C75A22] transition"
            >
              Bientôt disponible
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
