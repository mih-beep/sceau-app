import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      
      {/* Effet de fond lumineux */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#E76F51] rounded-full blur-[120px] opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#4A90C2] rounded-full blur-[120px] opacity-20"></div>

      <div className="z-10 text-center max-w-3xl mx-auto">
        <span className="inline-block bg-[#FFFCF7] border border-[#EFE0CA] text-[#A89070] text-xs font-mono font-bold px-4 py-2 rounded-full uppercase tracking-widest mb-8 shadow-sm">
          La couche de confiance du web
        </span>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight" style={{fontFamily: 'Cormorant Garamond', color: 'var(--text-main)'}}>
          Prouvez que vous l'avez <br/>
          créé <span className="text-[#E76F51] italic">en premier.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-[#7A5A3A] max-w-2xl mx-auto mb-12 italic" style={{fontFamily: 'Cormorant Garamond'}}>
          SCEAU est le premier réseau social où l'on ne dit pas, on prouve. Scellez vos œuvres gratuitement, avant de les publier. La preuve existe. Pour toujours.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
          <Link href="/seal" className="bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition duration-200">
            Sceller une œuvre
          </Link>
          <Link href="/feed" className="bg-[#FFFCF7] border-2 border-[#EFE0CA] text-[#2C1810] px-10 py-4 rounded-2xl font-bold text-lg hover:border-[#E76F51] transition duration-200">
            Explorer le réseau
          </Link>
        </div>

        {/* 3 Arguments clés */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2" style={{color: 'var(--text-main)'}}>Zéro friction</h3>
            <p className="text-sm text-[var(--text-muted)]">Glissez un fichier, tapez un texte, ou enregistrez un audio. En 1 clic, il est protégé.</p>
          </div>
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="font-bold mb-2" style={{color: 'var(--text-main)'}}>Preuve absolue</h3>
            <p className="text-sm text-[var(--text-muted)]">Une empreinte cryptographique (SHA-256) gravée pour l'éternité. Modifier un seul mot change tout.</p>
          </div>
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
            <div className="text-3xl mb-3">🌍</div>
            <h3 className="font-bold mb-2" style={{color: 'var(--text-main)'}}>Réseau vivant</h3>
            <p className="text-sm text-[var(--text-muted)]">Découvrez les créations du monde entier, ajoutez des amis et construisez votre CV de preuves.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
