#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API Profil : Ajout de la récupération des Projets
# ==========================================================
say "1/2 → API /api/profil (Ajout de la liste des projets)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/profil/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier profil/route.ts introuvable')

# Ajout de la requête pour les projets
old_query = """    const pacts = await pool.query("SELECT COUNT(*) as total_pacts FROM pact_signatures WHERE user_id = $1", [userId]);"""
new_query = """    const pacts = await pool.query("SELECT COUNT(*) as total_pacts FROM pact_signatures WHERE user_id = $1", [userId]);

    // Récupération des projets (Arbre de Merkle)
    const projects = await pool.query(`
      SELECT p.id, p.title, p.description, p.merkle_root, p.created_at, p.ots_proof,
             (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count
      FROM projects p WHERE p.author_id = $1 ORDER BY p.created_at DESC
    `, [userId]);"""

if old_query in s:
    s = s.replace(old_query, new_query)

# Ajout dans le retour JSON
old_return = """      badges: badges,
      seals: seals.rows
    });"""
new_return = """      badges: badges,
      seals: seals.rows,
      projects: projects.rows
    });"""

if old_return in s:
    s = s.replace(old_return, new_return)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API Profil mise à jour (projets inclus)')
PYEOF

# ==========================================================
# 2. UI Profil : Ajout de l'onglet et de la liste
# ==========================================================
say "2/2 → UI Profil (Onglet Projets Responsive)"

python3 - << 'PYEOF'
import sys
p = 'src/app/profil/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier profil/page.tsx introuvable')

# 1. Mise à jour du state pour inclure les projets
s = s.replace(
    "setData({ ...d, seals: d.seals || [], badges: d.badges || [], favorites: d.favorites || [] });",
    "setData({ ...d, seals: d.seals || [], badges: d.badges || [], favorites: d.favorites || [], projects: d.projects || [] });"
)

# 2. Ajout du compteur de projets
s = s.replace(
    "flash: data.seals.filter((s:any) => s.is_flash).length,",
    "flash: data.seals.filter((s:any) => s.is_flash).length,\n    projects: data.projects.length,"
)

# 3. Ajout du bouton de l'onglet Projets (après Favoris)
old_tab_buttons = """          <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'favorites' ? 'bg-[#FCEAD6] text-[#C44A2E] shadow' : 'opacity-50'}`}>📌 Favoris ({data.favorites?.length || 0})</button>
        </div>"""

new_tab_buttons = """          <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'favorites' ? 'bg-[#FCEAD6] text-[#C44A2E] shadow' : 'opacity-50'}`}>📌 Favoris ({data.favorites?.length || 0})</button>
          <button onClick={() => setActiveTab('projects')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'projects' ? 'bg-[#F0F6FC] text-[#2D6A9E] shadow' : 'opacity-50'}`}>📁 Projets ({counts.projects})</button>
        </div>"""

if old_tab_buttons in s:
    s = s.replace(old_tab_buttons, new_tab_buttons)

# 4. Rendu de la liste des projets (Si on est sur l'onglet)
old_render = """      <div className="space-y-3 mb-10">
        {filteredSeals.length === 0 && <p className="text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center">Aucune œuvre dans ce compartiment.</p>}"""

new_render = """      {/* RENDU DES PROJETS (Si l'onglet est actif) */}
      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {data.projects.length === 0 ? (
            <p className="col-span-full text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center border border-[var(--border-color)]">Aucun projet (Arbre de Merkle) créé pour le moment.</p>
          ) : (
            data.projects.map((project: any) => (
              <Link href={`/projets/${project.id}`} key={project.id} className="block bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm hover:border-[#4A90C2] transition group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-[var(--text-main)] group-hover:text-[#4A90C2] transition">{project.title}</h3>
                  <span className={`text-[0.65rem] font-bold px-2 py-1 rounded ${project.ots_proof ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                    {project.ots_proof ? '✅ Scellé' : '⏳ Pending'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-3">{project.description || "Dossier Miroir"}</p>
                <div className="flex justify-between items-center border-t border-[var(--border-color)] pt-3 mt-3">
                  <span className="text-xs font-bold text-[#4A90C2]">📁 {project.files_count} fichiers</span>
                  <span className="text-[0.65rem] font-mono text-[var(--text-muted)]">{new Date(project.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* RENDU DES SCEAUX (Si l'onglet n'est pas Projets) */}
      {activeTab !== 'projects' && (
        <div className="space-y-3 mb-10">
          {filteredSeals.length === 0 && <p className="text-[var(--text-muted)] italic text-sm p-4 bg-[var(--bg-surface)] rounded-xl text-center border border-[var(--border-color)]">Aucune œuvre dans ce compartiment.</p>}"""

if old_render in s:
    s = s.replace(old_render, new_render)

# Fermeture du div conditionnel pour les sceaux (ajout de la parenthèse fermante)
# On cherche la fin de la map des sceaux
old_end = """          </div>
        ))}
      </div>

      {showPortfolioModal && ("""
new_end = """          </div>
          ))}
        </div>
      )}

      {showPortfolioModal && ("""
if old_end in s:
    s = s.replace(old_end, new_end)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Profil mise à jour (onglet Projets ajouté)')
PYEOF

echo ""
echo -e "${GREEN}✅ Le profil inclut maintenant les Projets. Vérification du build...${NC}"
npm run build
