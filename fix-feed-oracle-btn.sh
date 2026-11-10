#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Remplacement du bouton + Sceller par + Oracle dans le Feed"

python3 - << 'PYEOF'
import sys
p = 'src/app/feed/page.tsx'
s = open(p, encoding='utf-8').read()

old_buttons = """        <div className="flex gap-2">
          <Link href="/messages?pact=true" className="bg-[#1A1513] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-black transition">
            + Pacte
          </Link>
          <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">
            + Sceller
          </Link>
        </div>"""

new_buttons = """        <div className="flex gap-2">
          <Link href="/messages?pact=true" className="bg-[#1A1513] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-black transition">
            + Pacte
          </Link>
          <Link href="/oracle" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">
            + Oracle
          </Link>
        </div>"""

if old_buttons in s:
    s = s.replace(old_buttons, new_buttons)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Bouton + Sceller → + Oracle')
else:
    print('  ⚠️ Pattern introuvable, vérification manuelle')
PYEOF

say "2/2 → Build final..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Le bouton du Feed pointe maintenant vers Oracle !${NC}"
