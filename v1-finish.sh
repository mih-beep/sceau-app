#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/3 → Restauration de postcss.config.mjs"

cat > postcss.config.mjs << 'EOF'
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
EOF

echo "  ✓ postcss.config.mjs restauré"

say "2/3 → Correction bug Projets (name -> title)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/seal/route.ts'
s = open(p, encoding='utf-8').read()
s = s.replace(
    '"INSERT INTO projects (author_id, name) VALUES ($1, $2) RETURNING id"',
    '"INSERT INTO projects (author_id, title) VALUES ($1, $2) RETURNING id"'
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Bug de colonne corrigé (API Seal -> title)')
PYEOF

say "3/3 → Correction UI Archive + Build final"

python3 - << 'PYEOF'
import sys
p = 'src/app/archive/page.tsx'
s = open(p, encoding='utf-8').read()
s = s.replace("a.status === 'modified'", "a.last_status === 'modified'")
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Archive corrigée (last_status)')
PYEOF

rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Tout est réparé ! Tu peux push.${NC}"
