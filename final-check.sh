#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/3 → Vérification de la page SCEAU Archive"
mkdir -p "src/app/archive"
if [ ! -f "src/app/archive/page.tsx" ]; then
    echo "  ⚠️ Page Archive manquante (Tu dois relancer le script archive-web.sh)"
else
    echo "  ✓ Page Archive présente"
fi

say "2/3 → Vérification des boutons Pactes (Feed & Messages)"
python3 - << 'PYEOF'
import os

# Feed
p1 = 'src/app/feed/page.tsx'
if os.path.exists(p1):
    s1 = open(p1, encoding='utf-8').read()
    if "+ Pacte" not in s1:
        # On ajoute le bouton s'il manque
        old_header = """<Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Sceller</Link>"""
        new_header = """<div className="flex gap-2"><Link href="/messages?pact=true" className="bg-[#1A1513] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Pacte</Link><Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Sceller</Link></div>"""
        s1 = s1.replace(old_header, new_header)
        open(p1, 'w', encoding='utf-8').write(s1)
    print('  ✓ Bouton Pacte vérifié sur le Feed')

# Messages
p2 = 'src/app/messages/page.tsx'
if os.path.exists(p2):
    s2 = open(p2, encoding='utf-8').read()
    if "PactMessage" not in s2:
        print('  ⚠️ Le composant PactMessage semble manquer dans les messages.')
    else:
        print('  ✓ Composant PactMessage présent')
PYEOF

say "3/3 → Vérification du Build"
npm run build

echo ""
echo -e "${GREEN}✅ Vérification terminée. Si le build est OK, tu peux push !${NC}"
