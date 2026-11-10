#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "Remplacement de 'Bitcoin' par 'Blockchain' dans l'interface..."

# Liste des fichiers à nettoyer
FILES=(
  "src/app/page.tsx"
  "src/app/layout.tsx"
  "src/app/seal/page.tsx"
  "src/app/archive/page.tsx"
  "src/app/profil/page.tsx"
  "src/app/o/[id]/page.tsx"
  "src/app/pricing/page.tsx"
  "src/components/Cockpit.tsx"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    # Remplace toutes les occurrences de Bitcoin par Blockchain
    sed -i 's/Bitcoin/Blockchain/g' "$FILE"
    sed -i 's/bitcoin/blockchain/g' "$FILE"
    echo "  ✓ $FILE nettoyé"
  fi
done

say "Mise à jour terminée. On relance le build."
rm -rf .next
npm run build
