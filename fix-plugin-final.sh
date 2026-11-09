#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Correction de l'erreur TypeScript (seal/page.tsx)
# ==========================================================
say "1/2 → Correction de l'erreur TypeScript (FormData)"

python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier seal/page.tsx introuvable')

# On force le cast "as string" et on s'assure que projectManifest n'est jamais undefined
s = s.replace(
    "formData.append('merkle_root', merkleRoot);", 
    "formData.append('merkle_root', merkleRoot as string);"
)
s = s.replace(
    "formData.append('manifest', JSON.stringify(projectManifest));", 
    "formData.append('manifest', JSON.stringify(projectManifest || []));"
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Erreur TS corrigée sur FormData')
PYEOF

# ==========================================================
# 2. Sécurisation de l'UI (Bouton Révoquer)
# ==========================================================
say "2/2 → Ajout du bouton Révoquer dans les Paramètres"

python3 - << 'PYEOF'
import sys
p = 'src/app/settings/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier settings/page.tsx introuvable')

# Ajout de la fonction delete si elle n'existe pas
if "async function revokeApiKey" not in s:
    old_load = """  function logout() {"""
    new_load = """  async function revokeApiKey(id: string) {
    if (!confirm('Voulez-vous vraiment révoquer cette clé ? Les plugins qui l\\'utilisent cesseront de fonctionner.')) return;
    const res = await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey)}&id=${id}`, { method: 'DELETE' });
    if (res.ok) loadApiKeys();
    else alert('Erreur lors de la révocation');
  }

  function logout() {"""
    s = s.replace(old_load, new_load)

# Modification de la liste pour afficher la croix
old_list = """                <div key={k.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#C9D8E8] text-xs">
                  <span className="font-bold">{k.name}</span>
                  <span className="text-[#8A7A72]">
                    {k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}
                  </span>
                </div>"""

new_list = """                <div key={k.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#C9D8E8] text-xs">
                  <span className="font-bold">{k.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#8A7A72]">
                      {k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}
                    </span>
                    <button onClick={() => revokeApiKey(k.id)} className="text-red-400 hover:text-red-600 font-bold" title="Révoquer">✕</button>
                  </div>
                </div>"""
    
if old_list in s:
    s = s.replace(old_list, new_list)
    print('  ✓ Bouton Révoquer ajouté')
else:
    print('  ⚠️ Bouton déjà présent ou pattern introuvable.')

open(p, 'w', encoding='utf-8').write(s)
PYEOF

echo ""
echo -e "${GREEN}✅ Patchs appliqués. Vérification du build...${NC}"
npm run build
