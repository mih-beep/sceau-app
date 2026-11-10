#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API PROJETS : Lister tous les projets de l'utilisateur
# ==========================================================
say "1/4 → Création de l'API /api/projects/list"

mkdir -p "src/app/api/projects/list"
cat > "src/app/api/projects/list/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ projects: [] });

  try {
    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) return NextResponse.json({ projects: [] });

    const result = await pool.query(`
      SELECT p.id, p.title, p.description, p.merkle_root, p.ots_proof, p.created_at, p.parent_id,
             (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count
      FROM projects p 
      WHERE p.author_id = $1 
      ORDER BY p.created_at DESC
    `, [user.rows[0].id]);

    return NextResponse.json({ projects: result.rows });
  } catch (e: any) {
    console.error('[projects/list]', e);
    return NextResponse.json({ projects: [] });
  }
}
EOF
echo "  ✓ API créée"

# ==========================================================
# 2. PAGE /projets : Refonte complète (liste des dossiers)
# ==========================================================
say "2/4 → Refonte de la page /projets"

mkdir -p "src/app/projets"
cat > "src/app/projets/page.tsx" << 'EOF'
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
EOF
echo "  ✓ Page /projets refondue"

# ==========================================================
# 3. Atelier : détecter ?mode=project pour pré-sélectionner
# ==========================================================
say "3/4 → Atelier : pré-sélection du mode Projet via URL"

python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
s = open(p, encoding='utf-8').read()

# Ajout de la détection du mode depuis l'URL
if "const initialMode = searchParams.get('mode')" not in s:
    s = s.replace(
        "const parentProjectId = searchParams.get('parent_project_id');",
        "const parentProjectId = searchParams.get('parent_project_id');\n  const initialMode = searchParams.get('mode');"
    )
    
    s = s.replace(
        "const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio' | 'project'>('file');",
        "const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio' | 'project'>(\n    (initialMode === 'project' ? 'project' : 'file') as any\n  );"
    )
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Atelier : mode Project activé via URL')
else:
    print('  ✓ Atelier déjà configuré')
PYEOF

# ==========================================================
# 4. Layout : Sidebar avec SCEAU Projets séparé
# ==========================================================
say "4/4 → Mise à jour du Sidebar (ajout de SCEAU Projets)"

python3 - << 'PYEOF'
import sys
p = 'src/app/layout.tsx'
s = open(p, encoding='utf-8').read()

old_sections = """  const navSections = [
    {
      title: 'Espace Public',
      links: [
        { name: 'Le Flux', path: '/feed' },
        { name: "L'Atelier", path: '/seal' },
      ]
    },
    {
      title: 'Espace Pro',
      links: [
        { name: 'Projets & Preuves', path: '/profil' },
        { name: 'SCEAU Archive', path: '/archive' },
        { name: 'Vérification', path: '/verify' },
        { name: 'Messagerie & Pactes', path: '/messages' },
      ]
    },
    {
      title: 'Réseau',
      links: [
        { name: 'Communauté', path: '/friends' },
      ]
    }
  ];"""

new_sections = """  const navSections = [
    {
      title: 'Espace Public',
      links: [
        { name: 'Le Flux', path: '/feed' },
        { name: "L'Atelier", path: '/seal' },
      ]
    },
    {
      title: 'Espace Pro',
      links: [
        { name: 'SCEAU Projets', path: '/projets' },
        { name: 'SCEAU Archive', path: '/archive' },
        { name: 'Mon Profil', path: '/profil' },
        { name: 'Vérification', path: '/verify' },
        { name: 'Messagerie & Pactes', path: '/messages' },
      ]
    },
    {
      title: 'Réseau',
      links: [
        { name: 'Communauté', path: '/friends' },
      ]
    }
  ];"""

if old_sections in s:
    s = s.replace(old_sections, new_sections)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Sidebar réorganisé (SCEAU Projets ajouté)')
else:
    print('  ⚠️ Pattern navSections introuvable')
PYEOF

say "Nettoyage du cache et build final..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ SCEAU Projets est maintenant un vrai produit à part !${NC}"
