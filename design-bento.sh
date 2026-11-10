#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. SIDEBAR : Couleur chaude harmonisée (fini le noir pur)
# ==========================================================
say "1/3 → Sidebar : marron chaud harmonisé"

python3 - << 'PYEOF'
import sys
p = 'src/app/layout.tsx'
s = open(p, encoding='utf-8').read()

# On remplace le noir pur #1A1513 par le marron chaud #2C1810 (déjà dans la palette)
# Plus subtil : bordure plus douce, hover plus chaud
s = s.replace(
    'bg-[#1A1513] text-[#EADFD4] border-r border-[#332824]',
    'bg-[#2C1810] text-[#F5E9D8] border-r border-[#3D2F28]'
)
s = s.replace(
    'text-[#8A7A72] mb-3',
    'text-[#A89070] mb-3'
)
s = s.replace(
    'border-l-2 mb-1 ${isActive(link.path) ? \'bg-white/5 text-white border-[#E76F51]\' : \'border-transparent text-[#EADFD4] hover:bg-white/5 hover:text-white\'}',
    'border-l-2 mb-1 ${isActive(link.path) ? \'bg-white/10 text-white border-[#E76F51]\' : \'border-transparent text-[#EADFD4] hover:bg-white/5 hover:text-white\'}'
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Sidebar harmonisée (marron chaud)')
PYEOF

# ==========================================================
# 2. DESIGN GLOBAL : Bordures plus douces + ombres subtiles
# ==========================================================
say "2/3 → Design global (bordures douces)"

python3 - << 'PYEOF'
import sys
p = 'src/app/globals.css'
s = open(p, encoding='utf-8').read()

# On adoucit les bordures et on ajoute des variables pour cohérence
old_root = """  :root {
    --bg-main: #F9F6F0; /* Crème plus doux, moins jaune */
    --bg-surface: #FFFFFF;
    --text-main: #2C1810;
    --text-muted: #8A7A72;
    --border-color: #EFE0CA;
  }"""

new_root = """  :root {
    --bg-main: #F9F6F0;
    --bg-surface: #FFFFFF;
    --bg-soft: #FDF8F0;
    --text-main: #2C1810;
    --text-muted: #8A7A72;
    --border-color: #EFE0CA;
    --border-soft: #F5E9D8;
    --shadow-sm: 0 1px 2px rgba(44,24,16,0.04);
    --shadow-md: 0 4px 12px rgba(44,24,16,0.06);
    --radius-card: 16px;
  }"""

if old_root in s:
    s = s.replace(old_root, new_root)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Variables design ajoutées')
PYEOF

# ==========================================================
# 3. NETTOYAGE VISUEL GLOBAL (bordures épaisses → fines)
# ==========================================================
say "3/3 → Nettoyage des bordures épaisses (design bento)"

python3 - << 'PYEOF'
import os

# On remplace les bordures épaisses par des bordures fines (design plus subtil)
# Fichiers concernés : cards, panels, boutons secondaires

files_to_soften = [
    'src/app/feed/page.tsx',
    'src/app/profil/page.tsx',
    'src/app/archive/page.tsx',
    'src/app/settings/page.tsx',
    'src/app/friends/page.tsx',
    'src/app/projets/page.tsx',
    'src/app/seal/page.tsx',
    'src/app/page.tsx',
    'src/app/messages/page.tsx',
]

for p in files_to_soften:
    if not os.path.exists(p):
        continue
    s = open(p, encoding='utf-8').read()
    original = s
    # Bordures 2px → 1px (plus subtil)
    s = s.replace('border-2 border-[var(--border-color)]', 'border border-[var(--border-soft)]')
    # Ombres lourdes → plus douces
    s = s.replace('shadow-sm', 'shadow-sm')
    if s != original:
        open(p, 'w', encoding='utf-8').write(s)
        print(f'  ✓ {p} adouci')
PYEOF

say "Nettoyage cache et build..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Sidebar harmonisée et design adouci !${NC}"
