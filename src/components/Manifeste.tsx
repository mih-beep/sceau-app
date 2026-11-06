import Link from 'next/link';

export default function Manifeste() {
  return (
    <div className="mt-16 mb-8 max-w-xl mx-auto px-4">
      <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-color)] rounded-3xl p-8 shadow-sm relative overflow-hidden">
        
        {/* Élément décoratif */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E76F51] via-[#F4A261] to-[#E9C46A]"></div>

        <div className="text-center mb-6">
          <span className="text-3xl mb-2 block">⚖️</span>
          <h3 className="font-serif text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            La justice a besoin d'yeux.
          </h3>
          <p className="text-sm text-[var(--text-muted)] italic mt-2">
            SCEAU ne réinvente pas la loi. SCEAU lui donne des yeux.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex gap-3 items-start">
            <div className="text-[#E76F51] mt-1 font-bold">1.</div>
            <div>
              <h4 className="font-bold text-sm" style={{color: 'var(--text-main)'}}>Le droit d'auteur</h4>
              <p className="text-xs text-[var(--text-muted)]">L'œuvre est de toi. Le hash prouve que c'est exactement ce fichier, avec ce contenu.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="text-[#E76F51] mt-1 font-bold">2.</div>
            <div>
              <h4 className="font-bold text-sm" style={{color: 'var(--text-main)'}}>La preuve d'antériorité</h4>
              <p className="text-xs text-[var(--text-muted)]">Tu l'as eu avant. L'horodatage cryptographique est infalsifiable et vérifiable par tous.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="text-[#E76F51] mt-1 font-bold">3.</div>
            <div>
              <h4 className="font-bold text-sm" style={{color: 'var(--text-main)'}}>Le journal des accès</h4>
              <p className="text-xs text-[var(--text-muted)]">L'autre l'a vu. Les traces de téléchargement et de consultation sont conservées.</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] text-center">
          <p className="text-xs font-mono font-bold" style={{color: 'var(--text-main)'}}>
            "Ce n'est pas la loi du plus fort. C'est la loi de la preuve."
          </p>
        </div>
      </div>
    </div>
  );
}
