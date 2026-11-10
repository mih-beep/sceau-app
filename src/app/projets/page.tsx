'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProjetsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { setLoading(false); return; }

    fetch(`/api/projects/list?pubkey=${encodeURIComponent(pubkey)}`)
      .then(r => r.json())
      .then(d => { setProjects(d.projects || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-5xl mx-auto font-sans w-full min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Projets</h1>
          <p className="text-sm text-[var(--text-muted)]">Le Git de la Preuve. Suivez chaque version de vos dossiers, scellée sur Bitcoin.</p>
        </div>
        <Link 
          href="/seal?mode=project" 
          className="bg-[#1A1513] text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition whitespace-nowrap"
        >
          + Nouveau Projet
        </Link>
      </div>

      {/* Explication rapide */}
      <div className="bg-[#F0F6FC] border border-[#C9D8E8] rounded-2xl p-5 mb-8">
        <h3 className="font-bold text-sm text-[#2D6A9E] mb-2">Comment ça marche ?</h3>
        <p className="text-xs text-[#2D6A9E] leading-relaxed">
          <strong>1.</strong> Créez un dossier (ex: "Refonte Site Client X"). <strong>2.</strong> Déposez tous vos fichiers. 
          <strong>3.</strong> SCEAU calcule un Hash Racine (Arbre de Merkle) pour tout le dossier. <strong>4.</strong> À chaque nouvelle version, 
          SCEAU affiche ce qui a changé (Vert = Ajouté, Orange = Modifié, Rouge = Supprimé).
        </p>
      </div>

      {/* Liste */}
      {loading ? (
        <p className="text-center font-mono py-10">Chargement...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>Aucun projet pour le moment.</h3>
          <p className="text-sm text-[var(--text-muted)] mb-6">Créez votre premier dossier miroir et protégez l'ensemble de vos fichiers avec un seul Hash gravé sur Bitcoin.</p>
          <Link href="/seal?mode=project" className="inline-block bg-[#E76F51] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md">
            Créer mon premier projet
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p: any) => (
            <Link 
              key={p.id} 
              href={`/projets/${p.id}`}
              className="block bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:border-[#4A90C2] hover:shadow-md transition group"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg group-hover:text-[#4A90C2] transition" style={{color: 'var(--text-main)'}}>
                  {p.title}
                </h3>
                <span className={`text-[0.65rem] font-bold px-2 py-1 rounded whitespace-nowrap ${p.ots_proof ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                  {p.ots_proof ? '✅ Scellé' : '⏳ En attente'}
                </span>
              </div>
              
              <p className="text-xs text-[var(--text-muted)] mb-4 line-clamp-2">
                {p.description || "Dossier Miroir (Arbre de Merkle)"}
              </p>
              
              <div className="flex justify-between items-center border-t border-[var(--border-color)] pt-3">
                <span className="text-xs font-bold text-[#4A90C2]">📁 {p.files_count} fichier(s)</span>
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)]">
                  {new Date(p.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
