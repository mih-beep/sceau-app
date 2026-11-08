#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Corriger la casse dans l'API Friends et User-Profile
# ==========================================================
say "1/3 → Correction de la casse (LOWER) dans les API"

# API Friends (GET et POST)
python3 - << 'PYEOF'
p = 'src/app/api/friends/route.ts'
s = open(p, encoding='utf-8').read()

# Remplacer les recherches par handle exact par LOWER(handle) = LOWER($1)
s = s.replace(
    'const myIdRes = await pool.query("SELECT id FROM users WHERE handle = $1", [me]);',
    'const myIdRes = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me]);'
)
s = s.replace(
    'const myId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me.replace(\'@\', \'\')])).rows[0]?.id;',
    'const myId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me.replace(\'@\', \'\')])).rows[0]?.id;'
)
s = s.replace(
    'const targetId = (await pool.query("SELECT id FROM users WHERE handle = $1", [target.replace(\'@\', \'\')])).rows[0]?.id;',
    'const targetId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [target.replace(\'@\', \'\')])).rows[0]?.id;'
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ friends/route.ts sécurisé (LOWER)')
PYEOF

# API Messages (pour les suggestions)
python3 - << 'PYEOF'
p = 'src/app/api/messages/route.ts'
s = open(p, encoding='utf-8').read()
s = s.replace(
    'const myId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0]?.id;',
    'const myId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me])).rows[0]?.id;'
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ messages/route.ts sécurisé (LOWER)')
PYEOF

# ==========================================================
# 2. Afficher un message si aucune suggestion dans Messages
# ==========================================================
say "2/3 → Ajout d'un texte si suggestions vides"

python3 - << 'PYEOF'
p = 'src/app/messages/page.tsx'
s = open(p, encoding='utf-8').read()

old = """        {suggestions.length > 0 && (
          <div className="mt-6 border-t border-[var(--border-color)] pt-4">
            <h2 className="text-xs font-mono font-bold text-[#A89070] mb-2">Suggestions</h2>
            {suggestions.map(c => (
              <div key={c.id} onClick={() => setActiveChat({ type: 'dm', id: c.handle, name: c.handle })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1 opacity-70 hover:opacity-100">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-[#A89070] bg-[var(--bg-main)] border border-[var(--border-color)]">
                  {c.handle[0].toUpperCase()}
                </div>
                <div className="font-bold text-sm text-[var(--text-muted)]">@{c.handle}</div>
              </div>
            ))}
          </div>
        )}"""

new = """        <div className="mt-6 border-t border-[var(--border-color)] pt-4">
          <h2 className="text-xs font-mono font-bold text-[#A89070] mb-2">Suggestions</h2>
          {suggestions.length > 0 ? (
            suggestions.map(c => (
              <div key={c.id} onClick={() => setActiveChat({ type: 'dm', id: c.handle, name: c.handle })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1 opacity-70 hover:opacity-100">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-[#A89070] bg-[var(--bg-main)] border border-[var(--border-color)]">
                  {c.handle[0].toUpperCase()}
                </div>
                <div className="font-bold text-sm text-[var(--text-muted)]">@{c.handle}</div>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">Aucune suggestion pour le moment.</p>
          )}
        </div>"""

if old not in s:
    raise SystemExit('  ✗ Bloc suggestions introuvable — vérifie le fichier')
s = s.replace(old, new)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ messages/page.tsx (message si aucune suggestion)')
PYEOF

# ==========================================================
# 3. Mode Flash : réactiver Photo et Audio
# ==========================================================
say "3/3 → Débloquer Photo et Audio en mode Flash"

python3 - << 'PYEOF'
p = 'src/app/seal/page.tsx'
s = open(p, encoding='utf-8').read()

# 3.1 Modifier le bouton Flash pour ne pas forcer 'text' par défaut
s = s.replace(
    """<button type="button" onClick={() => { setIsFlashMode(true); setMode('text'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isFlashMode ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash</button>""",
    """<button type="button" onClick={() => { setIsFlashMode(true); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isFlashMode ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash</button>"""
)

# 3.2 Afficher les boutons Photo et Audio même en mode Flash
# On retire la condition {!isFlashMode && ...} autour des boutons Photo et Audio
old_buttons = """            {!isFlashMode && <button type="button" onClick={() => setMode('media')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'media' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>📸 Photo</button>}
            {!isFlashMode && <button type="button" onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'audio' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>🎙️ Audio</button>}"""
new_buttons = """            <button type="button" onClick={() => setMode('media')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'media' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>📸 Photo</button>
            <button type="button" onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'audio' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>🎙️ Audio</button>"""
if old_buttons not in s:
    raise SystemExit('  ✗ Boutons Photo/Audio introuvables')
s = s.replace(old_buttons, new_buttons)

# 3.3 Retirer la condition isFlashMode sur le bouton "Fichier"
old_file_btn = """{!isFlashMode && <button type="button" onClick={() => setMode('file')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'file' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>📁 Fichier</button>}"""
new_file_btn = """<button type="button" onClick={() => setMode('file')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'file' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>📁 Fichier</button>"""
s = s.replace(old_file_btn, new_file_btn)

# 3.4 En mode Flash, forcer le stockage local (décocher isHosted)
# On ajoute un useEffect qui décoche automatiquement si on passe en Flash
old_effect = """  const [isRecording, setIsRecording] = useState(false);"""
new_effect = """  // Si on passe en mode Flash, on force le stockage local (pas d'hébergement Cloud)
  useState(() => {
    if (isFlashMode) setIsHosted(false);
  });

  const [isRecording, setIsRecording] = useState(false);"""
# On l'ajoute proprement dans le corps du composant via un bout de code avant le return
# En fait, le plus simple est de modifier le onClick du toggle Flash :
s = s.replace(
    """<button type="button" onClick={() => { setIsFlashMode(true); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isFlashMode ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash</button>""",
    """<button type="button" onClick={() => { setIsFlashMode(true); setIsHosted(false); setVisibility('private'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isFlashMode ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash</button>"""
)
s = s.replace(
    """<button type="button" onClick={() => { setIsFlashMode(false); setMode('file'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${!isFlashMode ? 'bg-[var(--bg-surface)] shadow text-[#E76F51]' : 'opacity-50'}`}>📁 Normal</button>""",
    """<button type="button" onClick={() => { setIsFlashMode(false); setMode('file'); setIsHosted(true); setVisibility('public'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${!isFlashMode ? 'bg-[var(--bg-surface)] shadow text-[#E76F51]' : 'opacity-50'}`}>📁 Normal</button>"""
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ seal/page.tsx : Flash autorise Photo/Audio, mode local forcé')
PYEOF

echo ""
echo -e "${GREEN}✅ 3 corrections appliquées.${NC}"
