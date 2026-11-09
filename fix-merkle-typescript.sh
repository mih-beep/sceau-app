#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "Correction du typage TypeScript dans merkle.ts"

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

echo ""
echo -e "${GREEN}✅ Typage corrigé. On vérifie le build...${NC}"
npm run build
