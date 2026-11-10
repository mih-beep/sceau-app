#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Correction du useState mode dans seal/page.tsx"

python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
s = open(p, encoding='utf-8').read()

# 1. Supprimer la déclaration orpheline si elle existe
s = s.replace(
    "  const initialMode = searchParams.get('mode');\n",
    ""
)

# 2. Remplacer le useState pour lire directement searchParams
old_usestate = """  const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio' | 'project'>(
    (initialMode === 'project' ? 'project' : 'file') as any
  );"""

new_usestate = """  const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio' | 'project'>(
    (searchParams.get('mode') === 'project' ? 'project' : 'file') as any
  );"""

if old_usestate in s:
    s = s.replace(old_usestate, new_usestate)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ useState mode corrigé (lecture directe)')
else:
    # Fallback : si le pattern exact n'est pas trouvé, on essaie une version plus souple
    import re
    pattern = re.compile(r"const\s*\[\s*mode\s*,\s*setMode\s*\]\s*=\s*useState<[^>]*>\([^)]*initialMode[^)]*\);", re.S)
    if pattern.search(s):
        s = pattern.sub(
            "const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio' | 'project'>((searchParams.get('mode') === 'project' ? 'project' : 'file') as any);",
            s
        )
        open(p, 'w', encoding='utf-8').write(s)
        print('  ✓ useState mode corrigé (fallback regex)')
    else:
        print('  ⚠️ Pattern useState introuvable, vérifie manuellement')
PYEOF

say "2/2 → Build final"

rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Build réussi ! Tu peux push.${NC}"
