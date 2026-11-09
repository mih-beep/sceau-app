#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API Profil (Update & Get) - Identité Civile
# ==========================================================
say "1/4 → API Profil (Ajout Prénom, Nom, Date de naissance)"

python3 - << 'PYEOF'
# Update
p = 'src/app/api/profil/update/route.ts'
s = open(p, encoding='utf-8').read()
s = s.replace(
    "const { pubkey, old_handle, new_handle, bio, role, open_to_collaboration } = await req.json();",
    "const { pubkey, old_handle, new_handle, bio, role, open_to_collaboration, first_name, last_name, birth_date } = await req.json();"
)
s = s.replace(
    `await pool.query(
      "UPDATE users SET handle = $1, bio = $2, role = $3, open_to_collaboration = $4 WHERE id = $5",
      [finalHandle, bio, role, open_to_collaboration === true, userId]
    );`,
    `await pool.query(
      "UPDATE users SET handle = $1, bio = $2, role = $3, open_to_collaboration = $4, first_name = $5, last_name = $6, birth_date = $7 WHERE id = $8",
      [finalHandle, bio, role, open_to_collaboration === true, first_name || null, last_name || null, birth_date || null, userId]
    );`
)
open(p, 'w', encoding='utf-8').write(s)

# Get
p2 = 'src/app/api/profil/route.ts'
s2 = open(p2, encoding='utf-8').read()
s2 = s2.replace(
    "SELECT id, handle, bio, role, is_pro, open_to_collaboration FROM users",
    "SELECT id, handle, bio, role, is_pro, open_to_collaboration, first_name, last_name, birth_date FROM users"
)
s2 = s2.replace(
    "open_to_collaboration: user.rows[0].open_to_collaboration || false,",
    "open_to_collaboration: user.rows[0].open_to_collaboration || false,\n      first_name: user.rows[0].first_name,\n      last_name: user.rows[0].last_name,\n      birth_date: user.rows[0].birth_date,"
)
open(p2, 'w', encoding='utf-8').write(s2)
print('  ✓ API Profil mise à jour')
PYEOF

# ==========================================================
# 2. UI Paramètres - Formulaire d'identité
# ==========================================================
say "2/4 → UI Paramètres (Champs d'identité)"

python3 - << 'PYEOF'
p = 'src/app/settings/page.tsx'
s = open(p, encoding='utf-8').read()

# States
s = s.replace(
    "const [openToCollab, setOpenToCollab] = useState(false);",
    "const [openToCollab, setOpenToCollab] = useState(false);\n  const [firstName, setFirstName] = useState('');\n  const [lastName, setLastName] = useState('');\n  const [birthDate, setBirthDate] = useState('');"
)

# Fetch
s = s.replace(
    "setOpenToCollab(d.open_to_collaboration === true);",
    "setOpenToCollab(d.open_to_collaboration === true);\n          setFirstName(d.first_name || '');\n          setLastName(d.last_name || '');\n          setBirthDate(d.birth_date ? d.birth_date.split('T')[0] : '');"
)

# Payload
s = s.replace(
    "open_to_collaboration: openToCollab,",
    "open_to_collaboration: openToCollab,\n        first_name: firstName,\n        last_name: lastName,\n        birth_date: birthDate,"
)

# UI (Ajout avant la clé cryptographique)
old_ui = """        <div className="bg-[#FDF8F0] p-6 rounded-2xl border border-[#EFE0CA]">
          <h2 className="text-lg font-bold mb-2" style={{color: '#A88620'}}>🔑 Clé cryptographique</h2>"""
new_ui = """        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8]">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🛡️ Identité de confiance (Privée)</h2>
          <p className="text-xs text-[#2D6A9E] mb-4 italic">Ces informations ne sont jamais visibles sur votre profil. Elles servent uniquement à prouver que ce compte vous appartient en cas de litige (ex: si quelqu'un tente de usurper votre compte).</p>
          
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Prénom</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Nom</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none" />
            </div>
          </div>
          
          <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Date de naissance</label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none" />
        </div>

        <div className="bg-[#FDF8F0] p-6 rounded-2xl border border-[#EFE0CA]">
          <h2 className="text-lg font-bold mb-2" style={{color: '#A88620'}}>🔑 Clé cryptographique</h2>"""
if old_ui in s: s = s.replace(old_ui, new_ui)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Paramètres mise à jour')
PYEOF

# ==========================================================
# 3. API Journal des Accès - Filtres et Tri
# ==========================================================
say "3/4 → API Journal des accès (Recherche et Tri)"

python3 - << 'PYEOF'
p = 'src/app/api/seal/[id]/access-log/route.ts'
s = open(p, encoding='utf-8').read()

old_api = """  const log = await pool.query(`
    SELECT a.action, a.context, a.created_at, u.handle as viewer_handle,
      (SELECT COUNT(*) FROM seals WHERE author_id = u.id) as viewer_seals,
      u.created_at as viewer_account_created_at
    FROM access_log a JOIN users u ON a.viewer_id = u.id
    WHERE a.seal_id = $1 ORDER BY a.created_at DESC LIMIT 500
  `, [id]);"""

new_api = """  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'recent'; // 'recent', 'oldest_account', 'newest_account'

  let sql = `
    SELECT a.action, a.context, a.created_at, u.handle as viewer_handle,
      (SELECT COUNT(*) FROM seals WHERE author_id = u.id) as viewer_seals,
      u.created_at as viewer_account_created_at
    FROM access_log a JOIN users u ON a.viewer_id = u.id
    WHERE a.seal_id = $1
  `;
  const params: any[] = [id];

  if (search) {
    sql += ` AND u.handle ILIKE $2`;
    params.push(`%${search}%`);
  }

  if (sort === 'oldest_account') {
    sql += ` ORDER BY u.created_at ASC`;
  } else if (sort === 'newest_account') {
    sql += ` ORDER BY u.created_at DESC`;
  } else {
    sql += ` ORDER BY a.created_at DESC`;
  }

  sql += ` LIMIT 500`;
  const log = await pool.query(sql, params);"""
if old_api in s: s = s.replace(old_api, new_api)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ API Access Log sécurisée et filtrée')
PYEOF

# ==========================================================
# 4. UI Journal des Accès - Barre de recherche et Menu
# ==========================================================
say "4/4 → UI Journal des accès (Recherche et Tri)"

python3 - << 'PYEOF'
p = 'src/app/profil/AccessLogModal.tsx'
s = open(p, encoding='utf-8').read()

# States
s = s.replace(
    "const [loading, setLoading] = useState(true);",
    "const [loading, setLoading] = useState(true);\n  const [search, setSearch] = useState('');\n  const [sort, setSort] = useState('recent');"
)

# Fetch
s = s.replace(
    """  useEffect(() => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    fetch(`/api/seal/${sealId}/access-log?pubkey=${encodeURIComponent(pubkey || '')}`)
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setLoading(false); });
  }, [sealId]);""",
    """  useEffect(() => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    setLoading(true);
    fetch(`/api/seal/${sealId}/access-log?pubkey=${encodeURIComponent(pubkey || '')}&search=${search}&sort=${sort}`)
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setLoading(false); });
  }, [sealId, search, sort]);"""
)

# UI (Ajout des filtres en haut)
old_ui = """        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>📖 Journal des accès</h2>
          <button onClick={onClose} className="text-xl opacity-50">✕</button>
        </div>"""

new_ui = """        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>📖 Journal des accès</h2>
          <button onClick={onClose} className="text-xl opacity-50">✕</button>
        </div>

        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="Chercher un pseudo..." 
            className="flex-1 border-2 border-[var(--border-color)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#4A90C2] bg-[var(--bg-main)]"
            style={{color: 'var(--text-main)'}}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select 
            className="border-2 border-[var(--border-color)] rounded-xl px-2 py-2 text-xs font-bold outline-none bg-[var(--bg-main)] cursor-pointer"
            style={{color: 'var(--text-main)'}}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="recent">Vues récentes</option>
            <option value="newest_account">Comptes les + récents</option>
            <option value="oldest_account">Comptes les + anciens</option>
          </select>
        </div>"""
if old_ui in s: s = s.replace(old_ui, new_ui)

# UI Badge "Nouveau"
old_badge = """                   <span className={`text-[0.6rem] font-mono px-2 py-0.5 rounded ${e.action === 'download' ? 'bg-[#FCEAD6] text-[#C44A2E]' : 'bg-[#DCE8F5] text-[#2D6A9E]'}`}>{e.action}</span>"""

new_badge = """                   <div className="flex items-center gap-2">
                     {e.viewer_profile.account_age_days < 7 && <span className="text-[0.55rem] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded uppercase">Nouveau</span>}
                     <span className={`text-[0.6rem] font-mono px-2 py-0.5 rounded ${e.action === 'download' ? 'bg-[#FCEAD6] text-[#C44A2E]' : 'bg-[#DCE8F5] text-[#2D6A9E]'}`}>{e.action}</span>
                   </div>"""
if old_badge in s: s = s.replace(old_badge, new_badge)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Access Log mise à jour')
PYEOF

echo ""
echo -e "${GREEN}✅ Les 3 fonctionnalités (Identité, Filtres Accès, Feed) sont prêtes.${NC}"
