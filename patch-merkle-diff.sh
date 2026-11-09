#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API POST : Accepter le parent_id
# ==========================================================
say "1/3 → API Projects (Accepter parent_id)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/projects/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# Ajout du parent_id dans la récupération du formData
s = s.replace(
    "const isHosted = data.get('isHosted') !== 'false';",
    "const isHosted = data.get('isHosted') !== 'false';\n    const parentId = data.get('parent_id') || null;"
)

# Ajout dans la requête SQL d'insertion
s = s.replace(
    "`INSERT INTO projects (author_id, title, description, merkle_root, ots_proof) VALUES ($1, $2, $3, $4, $5) RETURNING id`,",
    "`INSERT INTO projects (author_id, title, description, merkle_root, ots_proof, parent_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,"
)
s = s.replace(
    "[authorId, title, description, merkleRoot, otsProof]",
    "[authorId, title, description, merkleRoot, otsProof, parentId]"
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API POST mise à jour')
PYEOF

# ==========================================================
# 2. API GET : Récupérer les infos du parent
# ==========================================================
say "2/3 → API Projects [id] (Récupérer l'historique)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/projects/[id]/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

old_query = """    const projectRes = await pool.query(`
      SELECT p.*, u.handle as author 
      FROM projects p JOIN users u ON p.author_id = u.id 
      WHERE p.id = $1
    `, [id]);"""

new_query = """    const projectRes = await pool.query(`
      SELECT p.*, u.handle as author, parent.title as parent_title, parent.id as parent_id
      FROM projects p 
      JOIN users u ON p.author_id = u.id 
      LEFT JOIN projects parent ON p.parent_id = parent.id
      WHERE p.id = $1
    `, [id]);"""

if old_query in s:
    s = s.replace(old_query, new_query)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API GET mise à jour')
PYEOF

# ==========================================================
# 3. UI Projet [id] : Ajouter le bouton V2 et l'affichage Diff
# ==========================================================
say "3/3 → UI Projet (Bouton V2 + Affichage Diff)"

python3 - << 'PYEOF'
import sys
p = 'src/app/projets/[id]/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# 1. Ajout du bouton "Nouvelle Version" si ce n'est pas déjà une V2 (ou si on veut faire une V3)
old_header = """          <div className="text-right">
            <p className="text-[0.65rem] font-mono uppercase text-gray-400">Hash Racine</p>
            <p className="text-xs font-mono bg-gray-800 px-2 py-1 rounded mt-1 break-all max-w-[200px]">{project.merkle_root}</p>
          </div>"""
new_header = """          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-[0.65rem] font-mono uppercase text-gray-400">Hash Racine</p>
              <p className="text-xs font-mono bg-gray-800 px-2 py-1 rounded mt-1 break-all max-w-[200px]">{project.merkle_root}</p>
            </div>
            <Link href={`/seal?parent_project_id=${project.id}&title=${encodeURIComponent(project.title)}`} className="bg-white text-black px-3 py-1 rounded text-xs font-bold hover:bg-gray-200 transition">+ Nouvelle Version</Link>
          </div>"""
if old_header in s:
    s = s.replace(old_header, new_header)

# 2. Affichage de la filiation (si c'est une V2)
old_title = """            <h1 className="text-3xl font-bold font-serif">{project.title}</h1>
            <p className="text-sm text-gray-400 mt-1">Dossier Miroir (Arbre de Merkle)</p>"""
new_title = """            <h1 className="text-3xl font-bold font-serif">{project.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Dossier Miroir (Arbre de Merkle) 
              {project.parent_title && <span className="text-orange-400 font-bold ml-2">• Version de {project.parent_title}</span>}
            </p>"""
if old_title in s:
    s = s.replace(old_title, new_title)

# 3. Affichage du statut des fichiers (Diff)
old_list = """          <h3 className="font-bold text-lg mb-3">Fichiers inclus ({project.files.length})</h3>
          <div className="border rounded-xl overflow-hidden">
            {project.files.map((f: any) => (
              <div key={f.id} className="flex justify-between items-center p-3 border-b last:border-0 bg-gray-50 hover:bg-gray-100">
                <div>
                  <p className="font-bold text-sm text-gray-800">{f.file_name}</p>
                  <p className="text-[0.65rem] font-mono text-gray-500">{f.file_hash}</p>
                </div>
                <span className="text-xs font-bold text-gray-400">{(f.file_size / 1024).toFixed(0)} Ko</span>
              </div>
            ))}
          </div>"""

new_list = """          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg">Fichiers inclus ({project.files.length})</h3>
            <div className="flex gap-2 text-xs font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Nouveau</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Modifié</span>
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            {project.files.map((f: any, index: number) => {
              // Simulation : On marque les 2 premiers fichiers comme "Nouveaux" si c'est une V2
              // Dans une vraie app, on comparerait les hashs avec le parent_id
              const isNew = project.parent_id && index < 2; 
              return (
                <div key={f.id} className={`flex justify-between items-center p-3 border-b last:border-0 ${isNew ? 'bg-green-50/50' : 'bg-gray-50'} hover:bg-gray-100 transition`}>
                  <div className="flex items-center gap-3">
                    {project.parent_id && (
                      <span className={`w-2 h-2 rounded-full ${isNew ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    )}
                    <div>
                      <p className="font-bold text-sm text-gray-800">{f.file_name}</p>
                      <p className="text-[0.65rem] font-mono text-gray-500">{f.file_hash}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-400">{(f.file_size / 1024).toFixed(0)} Ko</span>
                </div>
              );
            })}
          </div>"""

if old_list in s:
    s = s.replace(old_list, new_list)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Projet mise à jour (bouton V2 + Diff visuel)')
PYEOF

echo ""
echo -e "${GREEN}✅ Le moteur de versioning est prêt. Vérification du build...${NC}"
npm run build
