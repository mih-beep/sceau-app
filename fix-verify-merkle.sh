#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Correction du typage TS dans merkle.ts
# ==========================================================
say "1/3 → Correction de merkle.ts (Typage TS)"

cat > src/lib/merkle.ts << 'EOF'
import { sha256 } from '@noble/hashes/sha256';

/**
 * Prend une liste de hashs (en Base64) et calcule le Hash Racine (Merkle Root).
 * Utilise Uint8Array pour éviter les conflits de types avec Buffer.
 */
export function buildMerkleRoot(hashesB64: string[]): string {
  if (hashesB64.length === 0) return '';
  if (hashesB64.length === 1) return hashesB64[0];

  // Convertir les hashs Base64 en Uint8Array
  let currentLevel: Uint8Array[] = hashesB64.map(h => {
    const binaryString = atob(h);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  });

  while (currentLevel.length > 1) {
    const nextLevel: Uint8Array[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Concaténer les deux hashs
        const combined = new Uint8Array(currentLevel[i].length + currentLevel[i + 1].length);
        combined.set(currentLevel[i], 0);
        combined.set(currentLevel[i + 1], currentLevel[i].length);
        
        // Calculer le hash du résultat
        const hash = sha256(combined);
        nextLevel.push(hash);
      } else {
        // S'il reste un élément impair, on le passe au niveau supérieur
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }

  // Convertir le Uint8Array final en Base64
  const root = currentLevel[0];
  let binary = '';
  const len = root.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(root[i]);
  }
  
  return btoa(binary);
}
EOF

# ==========================================================
# 2. API Verify : Ajout de la recherche dans les Projets
# ==========================================================
say "2/3 → Mise à jour de /api/verify (Recherche inversée)"

cat > "src/app/api/verify/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { hash, query } = await req.json();
    
    // 1. Recherche par Hash (Vérification classique + Projets)
    if (hash) {
      // a) On cherche dans les sceaux individuels
      const sealResult = await pool.query(`
        SELECT s.title, s.timestamp, s.is_hosted, s.file_path, s.category, u.handle as author,
               'seal' as type
        FROM seals s JOIN users u ON s.author_id = u.id
        WHERE encode(s.hash, 'base64') = $1
      `, [hash]);

      // b) On cherche dans les fichiers de projets (Arbre de Merkle)
      const projectResult = await pool.query(`
        SELECT pf.file_name as title, p.created_at as timestamp, 
               CASE WHEN pf.file_path IS NOT NULL THEN true ELSE false END as is_hosted, 
               pf.file_path, 'Projet' as category, u.handle as author,
               'project' as type, p.title as project_title, p.id as project_id
        FROM project_files pf 
        JOIN projects p ON pf.project_id = p.id
        JOIN users u ON p.author_id = u.id
        WHERE pf.file_hash = $1
      `, [hash]);

      const combinedSeals = [...sealResult.rows, ...projectResult.rows];

      if (combinedSeals.length > 0) {
        return NextResponse.json({ found: true, seals: combinedSeals });
      }
      return NextResponse.json({ found: false });
    }

    // 2. Recherche par Titre (Découverte publique)
    if (query) {
      const result = await pool.query(`
        SELECT s.title, s.timestamp, s.is_hosted, s.file_path, s.category, encode(s.hash, 'base64') as hash, u.handle as author
        FROM seals s JOIN users u ON s.author_id = u.id
        WHERE s.title ILIKE $1 AND s.is_public = TRUE
        ORDER BY s.timestamp DESC LIMIT 20
      `, [`%${query}%`]);
      
      return NextResponse.json({ found: result.rows.length > 0, seals: result.rows });
    }

    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF

# ==========================================================
# 3. UI Verify : Affichage du résultat "Projet"
# ==========================================================
say "3/3 → Mise à jour UI /verify (Affichage Projet)"

python3 - << 'PYEOF'
import sys
p = 'src/app/verify/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier verify/page.tsx introuvable')

# Ajouter l'affichage du badge Projet dans les résultats
old_result = """                        <div className="font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Par <span className="font-bold text-[#E76F51]">@{seal.author}</span> le {new Date(seal.timestamp).toLocaleString('fr-FR')}
                        </div>"""

new_result = """                        <div className="font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Par <span className="font-bold text-[#E76F51]">@{seal.author}</span> le {new Date(seal.timestamp).toLocaleString('fr-FR')}
                        </div>
                        {seal.type === 'project' && (
                          <div className="mt-2 inline-block bg-[#F0F6FC] border border-[#C9D8E8] text-[#2D6A9E] px-2 py-1 rounded text-[0.65rem] font-bold">
                            🛡️ Fait partie du dossier : {seal.project_title}
                          </div>
                        )}"""
if old_result in s:
    s = s.replace(old_result, new_result)
else:
    print('  ⚠️ Impossible de trouver le bloc de résultat, vérifie le fichier manuellement.')

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Vérifier mise à jour.')
PYEOF

echo ""
echo -e "${GREEN}✅ Correctifs appliqués. On vérifie le build...${NC}"
npm run build
