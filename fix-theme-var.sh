#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Correction de la variable 'theme' dans pacts/create"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/pacts/create/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# On affiche ce qu'on trouve pour comprendre la structure
print("  → Contenu actuel (extrait) :")
for line in s.split('\n'):
    if 'isHosted' in line or 'const theme' in line:
        print(f"    {line.strip()}")

# Chercher la vraie ligne isHosted (peut être === ou !==)
import re
match = re.search(r"(const isHosted = data\.get\('isHosted'\)[^;]+;)", s)

if not match:
    sys.exit('  ✗ Impossible de trouver la ligne isHosted')

line_isHosted = match.group(1)
print(f"  → Ligne trouvée : {line_isHosted}")

# Si theme n'est pas déjà déclaré, on l'ajoute juste après
if "const theme = data.get('theme')" not in s:
    s = s.replace(
        line_isHosted,
        line_isHosted + "\n    const theme = data.get('theme') || 'serieux';"
    )
    open(p, 'w', encoding='utf-8').write(s)
    print("  ✓ Variable 'theme' déclarée avec succès")
else:
    print("  ✓ Variable 'theme' déjà déclarée")
PYEOF

say "2/2 → Vérification du build"
npm run build
