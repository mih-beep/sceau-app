#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Correction Atelier (Buffer -> atob côté client)
# ==========================================================
say "1/5 → Correction Atelier (Calcul Merkle côté client)"

python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# Correction du Buffer côté client
old_hash = "hashContent = new Uint8Array(Buffer.from(merkleRoot, 'base64'));"
new_hash = "hashContent = new Uint8Array(Array.from(atob(merkleRoot), c => c.charCodeAt(0)));"
if old_hash in s:
    s = s.replace(old_hash, new_hash)

# Sécurisation de sendToServer (vérification TypeScript)
old_send = """    if (mode === 'project') {
      endpoint = '/api/projects';
      formData.append('isHosted', isHosted.toString());
      formData.append('merkle_root', merkleRoot);
      formData.append('manifest', JSON.stringify(projectManifest));
      projectFiles.forEach(f => formData.append('files', f));
    } else if (isPactMode) {"""
new_send = """    if (mode === 'project' && merkleRoot && projectManifest) {
      endpoint = '/api/projects';
      formData.append('isHosted', isHosted.toString());
      formData.append('merkle_root', merkleRoot);
      formData.append('manifest', JSON.stringify(projectManifest));
      projectFiles.forEach(f => formData.append('files', f));
    } else if (isPactMode) {"""
if old_send in s:
    s = s.replace(old_send, new_send)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Atelier corrigé')
PYEOF

# ==========================================================
# 2. Sécurisation API Projects
# ==========================================================
say "2/5 → Sécurisation API Projects (Tailles, Extensions)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/projects/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

old_check = """    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!merkleRoot || !manifestStr) return NextResponse.json({ error: 'Manifest Merkle manquant' }, { status: 400 });"""

new_check = """    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!merkleRoot || !manifestStr) return NextResponse.json({ error: 'Manifest Merkle manquant' }, { status: 400 });
    if (files.length > 100) return NextResponse.json({ error: 'Maximum 100 fichiers par projet' }, { status: 400 });
    
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf', 'txt', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'html', 'css', 'js', 'ts', 'json'];
    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      const ext = file.name.toLowerCase().split('.').pop() || '';
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json({ error: `Format interdit : ${file.name}` }, { status: 400 });
      }
    }
    if (totalSize > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Le projet dépasse 100 Mo' }, { status: 413 });
    }"""

if old_check in s:
    s = s.replace(old_check, new_check)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API Projects sécurisée')
PYEOF

# ==========================================================
# 3. Ajout de used_bytes dans l'API Profil
# ==========================================================
say "3/5 → API Profil (Ajout de la taille totale)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/profil/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

s = s.replace(
    "SELECT COUNT(id) as total_sealed, SUM(CASE WHEN is_hosted = true THEN 1 ELSE 0 END) as total_hosted",
    "SELECT COUNT(id) as total_sealed, SUM(CASE WHEN is_hosted = true THEN 1 ELSE 0 END) as total_hosted, SUM(file_size) as total_size"
)

s = s.replace(
    "hosted: parseInt(stats.rows[0].total_hosted || 0),",
    "hosted: parseInt(stats.rows[0].total_hosted || 0),\n      used_bytes: parseInt(stats.rows[0].total_size || 0),"
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API Profil mise à jour')
PYEOF

# ==========================================================
# 4. Correction de la jauge dans le Cockpit
# ==========================================================
say "4/5 → Correction Jauge Cockpit"

python3 - << 'PYEOF'
import sys
p = 'src/components/Cockpit.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

s = s.replace(
    "const usedBytes = profile?.hosted ? profile.hosted * 1024 * 1024 : 0; // Approximation (à affiner selon la vraie API)",
    "const usedBytes = profile?.used_bytes || 0;"
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Cockpit corrigé (Jauge réelle)')
PYEOF

# ==========================================================
# 5. Limite de taille pour le Plugin Seal
# ==========================================================
say "5/5 → Limite de taille Plugin Seal"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/v1/plugin/seal/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

s = s.replace(
    """    if (!apiKey || !title || !content) {
      return NextResponse.json({ error: 'Champs manquants (apiKey, title, content)' }, { status: 400, headers: CORS });
    }""",
    """    if (!apiKey || !title || !content) {
      return NextResponse.json({ error: 'Champs manquants (apiKey, title, content)' }, { status: 400, headers: CORS });
    }
    if (content.length > 1024 * 1024) {
      return NextResponse.json({ error: 'Contenu trop long (max 1 Mo)' }, { status: 413, headers: CORS });
    }"""
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Plugin Seal sécurisé')
PYEOF

echo ""
echo -e "${GREEN}✅ Audit terminé. Vérification du build...${NC}"
npm run build
