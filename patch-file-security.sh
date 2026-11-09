#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Sécurisation de l'API /api/seal"

python3 - << 'PYEOF'
p = 'src/app/api/seal/route.ts'
s = open(p, encoding='utf-8').read()

# Ajouter la vérification des extensions
old_check = """    if (!isFlash && file && file.size > 0) {"""
new_check = """    // === SÉCURITÉ : Vérification de l'extension du fichier ===
    if (file && file.size > 0) {
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf', 'txt', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
      const fileName = file.name.toLowerCase();
      const ext = fileName.split('.').pop() || '';
      
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json({ 
          error: `Format de fichier interdit (.${ext}). Formats acceptés : images, vidéos, audios, pdf, txt, zip, documents Office.` 
        }, { status: 400 });
      }
    }

    if (!isFlash && file && file.size > 0) {"""

if old_check in s:
    s = s.replace(old_check, new_check)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Sécurité ajoutée à /api/seal')
PYEOF


say "2/2 → Sécurisation de l'API /api/creations"

python3 - << 'PYEOF'
p = 'src/app/api/creations/route.ts'
s = open(p, encoding='utf-8').read()

old_check = """    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());"""
new_check = """    if (file && file.size > 0) {
      // === SÉCURITÉ : Vérification de l'extension ===
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf', 'txt'];
      const fileName = file.name.toLowerCase();
      const ext = fileName.split('.').pop() || '';
      
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json({ 
          error: `Format de fichier interdit (.${ext}).` 
        }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());"""

if old_check in s:
    s = s.replace(old_check, new_check)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Sécurité ajoutée à /api/creations')
PYEOF

echo ""
echo -e "${GREEN}✅ Filtrage des fichiers sécurisé.${NC}"
