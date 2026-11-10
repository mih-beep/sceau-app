#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. CORRECTION DU TEXTE "BLOCKCHAIN BLOCKCHAIN"
# ==========================================================
say "1/3 → Correction de la répétition sur la Landing Page"

python3 - << 'PYEOF'
import sys
p = 'src/app/page.tsx'
s = open(p, encoding='utf-8').read()

old_text = "La preuve est gravée sur la blockchain Blockchain. Pour toujours."
new_text = "La preuve est gravée sur la blockchain. Pour toujours."

if old_text in s:
    s = s.replace(old_text, new_text)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Texte corrigé')
else:
    # Si la phrase a légèrement changé, on fait un remplacement plus large
    s = s.replace("blockchain Blockchain", "blockchain")
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Répétition "blockchain" nettoyée')
PYEOF

# ==========================================================
# 2. AJOUT DU PADDING BOTTOM POUR LE MENU MOBILE (TOUTES LES PAGES)
# ==========================================================
say "2/3 → Ajout du padding mobile sur toutes les pages"

python3 - << 'PYEOF'
import os

pages = [
    ('src/app/archive/page.tsx', '<div className="p-6 max-w-4xl mx-auto font-sans w-full min-h-screen">', '<div className="p-6 pb-32 md:pb-6 max-w-4xl mx-auto font-sans w-full min-h-screen">'),
    ('src/app/verify/page.tsx', '<div className="p-6 max-w-2xl md:max-w-5xl mx-auto font-sans w-full">', '<div className="p-6 pb-32 md:pb-6 max-w-2xl md:max-w-5xl mx-auto font-sans w-full">'),
    ('src/app/settings/page.tsx', '<div className="p-6 max-w-2xl md:max-w-4xl mx-auto font-sans w-full">', '<div className="p-6 pb-32 md:pb-6 max-w-2xl md:max-w-4xl mx-auto font-sans w-full">'),
    ('src/app/friends/page.tsx', '<div className="p-6 max-w-2xl mx-auto font-serif min-h-screen">', '<div className="p-6 pb-32 md:pb-6 max-w-2xl mx-auto font-serif min-h-screen">'),
    ('src/app/projets/[id]/page.tsx', '<div className="p-6 max-w-4xl mx-auto font-sans">', '<div className="p-6 pb-32 md:pb-6 max-w-4xl mx-auto font-sans">'),
]

for path, old, new in pages:
    if os.path.exists(path):
        s = open(path, encoding='utf-8').read()
        if old in s:
            s = s.replace(old, new)
            open(path, 'w', encoding='utf-8').write(s)
            print(f'  ✓ {path} : padding mobile ajouté')
        else:
            print(f'  ⚠️ {path} : pattern introuvable (vérifie manuellement)')
    else:
        print(f'  ⚠️ {path} : fichier introuvable')
PYEOF

# ==========================================================
# 3. RENDRE LA PAGE PROJETS RESPONSIVE (MOBILE FRIENDLY)
# ==========================================================
say "3/3 → Adaptation de la page Projet (Dossier Miroir) pour mobile"

python3 - << 'PYEOF'
import sys
p = 'src/app/projets/[id]/page.tsx'
s = open(p, encoding='utf-8').read()

# 1. Header du projet : passer en colonne sur mobile
s = s.replace(
    '<div className="bg-[#1E1E1E] p-6 text-white flex justify-between items-center">',
    '<div className="bg-[#1E1E1E] p-6 text-white flex flex-col md:flex-row justify-between md:items-center gap-4">'
)

# 2. Alignement du Hash : centré sur mobile
s = s.replace(
    '<div className="flex flex-col items-end gap-2">',
    '<div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">'
)
s = s.replace(
    '<div className="text-right">',
    '<div className="text-left md:text-right w-full">'
)
s = s.replace(
    'break-all max-w-[200px]',
    'break-all max-w-full md:max-w-[200px]'
)

# 3. Les boutons (OTs et PDF) : en colonne sur mobile
s = s.replace(
    '<div className="flex gap-4 mb-6">',
    '<div className="flex flex-col md:flex-row gap-4 mb-6">'
)

# 4. La liste des fichiers : le hash peut être long, on s'assure qu'il wrap
s = s.replace(
    '<p className="text-[0.65rem] font-mono text-gray-500">{f.file_hash}</p>',
    '<p className="text-[0.65rem] font-mono text-gray-500 break-all">{f.file_hash}</p>'
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Page Projet adaptée pour mobile (responsive)')
PYEOF

say "Nettoyage du cache et build..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Corrections appliquées ! Ton app est maintenant parfaite sur mobile.${NC}"
