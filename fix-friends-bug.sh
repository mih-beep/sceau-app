#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/3 → Patch API /api/friends"
python3 - << 'PYEOF'
import sys
p = 'src/app/api/friends/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError: sys.exit('  ✗ introuvable')

# Sécurisation de la recherche
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
print('  ✓ /api/friends corrigé')
PYEOF

say "2/3 → Patch API /api/messages"
python3 - << 'PYEOF'
import sys
p = 'src/app/api/messages/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError: sys.exit('  ✗ introuvable')

s = s.replace(
    'const myId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0]?.id;',
    'const myId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me])).rows[0]?.id;'
)
s = s.replace(
    'const sender = await pool.query("SELECT id FROM users WHERE handle = $1", [sender_handle]);',
    'const sender = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [sender_handle]);'
)
s = s.replace(
    'const receiver = await pool.query("SELECT id FROM users WHERE handle = $1", [receiver_handle]);',
    'const receiver = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [receiver_handle]);'
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ /api/messages corrigé')
PYEOF

say "3/3 → Patch API /api/user-profile/[handle] et /api/notifications"
python3 - << 'PYEOF'
import sys

# User Profile
p1 = 'src/app/api/user-profile/[handle]/route.ts'
try:
    s1 = open(p1, encoding='utf-8').read()
    s1 = s1.replace(
        'const user = await pool.query("SELECT id, handle, bio, role, open_to_collaboration FROM users WHERE handle = $1", [handle]);',
        'const user = await pool.query("SELECT id, handle, bio, role, open_to_collaboration FROM users WHERE LOWER(handle) = LOWER($1)", [handle]);'
    )
    s1 = s1.replace(
        'const viewer = await pool.query("SELECT id FROM users WHERE handle = $1", [viewerHandle]);',
        'const viewer = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [viewerHandle]);'
    )
    open(p1, 'w', encoding='utf-8').write(s1)
except: pass

# Notifications
p2 = 'src/app/api/notifications/route.ts'
try:
    s2 = open(p2, encoding='utf-8').read()
    s2 = s2.replace(
        'const myId = (await pool.query("SELECT id FROM users WHERE handle = $1", [me])).rows[0]?.id;',
        'const myId = (await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [me])).rows[0]?.id;'
    )
    open(p2, 'w', encoding='utf-8').write(s2)
except: pass

print('  ✓ Profil et Notifications corrigés')
PYEOF

echo ""
echo -e "${GREEN}✅ Les API sont maintenant immunisées contre les erreurs de casse.${NC}"
