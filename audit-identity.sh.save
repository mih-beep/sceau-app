#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/3 → Modification de l'API Profil (Limite de 3 changements)"
python3 - << 'PYEOF'
import sys
p = 'src/app/api/profil/update/route.ts'
s = open(p, encoding='utf-8').read()

old_update = """    const finalHandle = new_handle || old_handle;
    await pool.query(
      "UPDATE users SET handle = $1, bio = $2, role = $3, open_to_collaboration = $4, first_name = $5, last_name = $6, birth_date = $7 WHERE id = $8",
      [finalHandle, bio, role, open_to_collaboration === true, first_name || null, last_name || null, birth_date || null, userId]
    );"""

new_update = """    const finalHandle = new_handle || old_handle;
    
    // Vérification des changements d'identité
    const currentUser = await pool.query("SELECT first_name, last_name, birth_date, identity_changes_count, identity_history FROM users WHERE id = $1", [userId]);
    const current = currentUser.rows[0];
    let changesCount = current.identity_changes_count || 0;
    let history = current.identity_history || [];
    
    const identityChanged = (first_name !== current.first_name) || (last_name !== current.last_name) || (birth_date !== current.birth_date);

    if (identityChanged) {
      if (changesCount >= 3) {
        return NextResponse.json({ error: "Limite atteinte : vous ne pouvez modifier votre identité de confiance que 3 fois maximum." }, { status: 403 });
      }
      
      changesCount++;
      history.push({
        date: new Date().toISOString(),
        old_name: `${current.first_name || ''} ${current.last_name || ''}`.trim(),
        new_name: `${first_name || ''} ${last_name || ''}`.trim(),
        old_birth: current.birth_date,
        new_birth: birth_date
      });
    }

    await pool.query(
      "UPDATE users SET handle = $1, bio = $2, role = $3, open_to_collaboration = $4, first_name = $5, last_name = $6, birth_date = $7, identity_changes_count = $8, identity_history = $9 WHERE id = $10",
      [finalHandle, bio, role, open_to_collaboration === true, first_name || null, last_name || null, birth_date || null, changesCount, JSON.stringify(history), userId]
    );"""

if old_update in s:
    s = s.replace(old_update, new_update)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ API Update sécurisée (Limite 3 changements)')
PYEOF

say "2/3 → Modification des Paramètres (Alerte et Désactivation)"
python3 - << 'PYEOF'
import sys
p = 'src/app/settings/page.tsx'
s = open(p, encoding='utf-8').read()

# Ajout des states
s = s.replace(
    "const [birthDate, setBirthDate] = useState('');",
    "const [birthDate, setBirthDate] = useState('');\n  const [identityCount, setIdentityCount] = useState(0);\n  const [identityHistory, setIdentityHistory] = useState<any[]>([]);"
)

# Récupération depuis l'API
s = s.replace(
    "setBirthDate(d.birth_date ? d.birth_date.split('T')[0] : '');",
    "setBirthDate(d.birth_date ? d.birth_date.split('T')[0] : '');\n          setIdentityCount(d.identity_changes_count || 0);\n          setIdentityHistory(d.identity_history || []);"
)

# Modification de l'UI (le bloc Identité de confiance)
old_ui = """        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8]">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🛡️ Identité de confiance (Privée)</h2>
          <p className="text-xs text-[#2D6A9E] mb-4 italic">Ces informations ne sont jamais visibles sur votre profil. Elles servent uniquement à prouver que ce compte vous appartient en cas de litige.</p>
          
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
        </div>"""

new_ui = """        <div className={`p-6 rounded-2xl border ${identityCount >= 3 ? 'bg-red-50 border-red-200' : 'bg-[#F0F6FC] border-[#C9D8E8]'}`}>
          <div className="flex justify-between items-start mb-2">
            <h2 className={`text-lg font-bold ${identityCount >= 3 ? 'text-red-700' : 'text-[#2D6A9E]'}`}>🛡️ Identité de confiance (Privée)</h2>
            {identityCount > 0 && (
              <div className="relative group cursor-help">
                <span className="bg-orange-100 text-orange-600 font-bold px-2 py-1 rounded text-xs border border-orange-200">
                  ⚠️ {3 - identityCount} modification(s) restante(s)
                </span>
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs p-3 rounded-lg shadow-xl hidden group-hover:block z-50">
                  <p className="font-bold mb-1 border-b border-gray-700 pb-1">Historique des changements</p>
                  {identityHistory.map((h: any, i: number) => (
                    <p key={i} className="mt-1 opacity-80">Le {new Date(h.date).toLocaleDateString()} : {h.old_name} → {h.new_name}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className={`text-xs mb-4 italic ${identityCount >= 3 ? 'text-red-600' : 'text-[#2D6A9E]'}`}>
            Ces informations servent uniquement à prouver que ce compte vous appartient. <strong>Vous ne pouvez les modifier que 3 fois maximum.</strong>
          </p>
          
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Prénom</label>
              <input type="text" disabled={identityCount >= 3} value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none disabled:opacity-50 disabled:bg-gray-100" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Nom</label>
              <input type="text" disabled={identityCount >= 3} value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none disabled:opacity-50 disabled:bg-gray-100" />
            </div>
          </div>
          
          <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Date de naissance</label>
          <input type="date" disabled={identityCount >= 3} value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none disabled:opacity-50 disabled:bg-gray-100" />
        </div>"""

if old_ui in s:
    s = s.replace(old_ui, new_ui)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ UI Settings : Limite et Alerte ajoutées')
PYEOF

say "3/3 → Correction du Mode Sombre (Dark Mode sur PC)"
python3 - << 'PYEOF'
import sys
p = 'src/app/globals.css'
s = open(p, encoding='utf-8').read()

# On s'assure que le mode sombre gère bien les variables du layout Desktop
old_dark = """.dark {
    --bg-main: #121212;
    --bg-surface: #1E1E1E;
    --text-main: #F5E9D8;
    --text-muted: #888;
    --border-color: #333;
  }"""

new_dark = """.dark {
    --bg-main: #0F0F0F; /* Noir très profond */
    --bg-surface: #1A1A1A; /* Gris foncé pour les cartes */
    --text-main: #EDEDED;
    --text-muted: #A0A0A0;
    --border-color: #2A2A2A;
  }
  
  /* On force la Sidebar à rester sombre même en mode clair */
  .dark aside, .dark .Cockpit {
    background-color: #050505 !important;
    border-color: #2A2A2A !important;
  }"""

if old_dark in s:
    s = s.replace(old_dark, new_dark)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Variables Dark Mode renforcées')
PYEOF

say "Nettoyage du cache et build..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Système d'audit d'identité et Dark Mode prêts !${NC}"
