#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Correction du conflit de variable 'params'"
python3 - << 'PYEOF'
p = 'src/app/api/seal/[id]/access-log/route.ts'
s = open(p, encoding='utf-8').read()

# On renomme la variable de requête SQL en 'queryParams'
s = s.replace('const params: any[] = [id];', 'const queryParams: any[] = [id];')
s = s.replace('params.push(`%${search}%`);', 'queryParams.push(`%${search}%`);')
s = s.replace('const log = await pool.query(sql, params);', 'const log = await pool.query(sql, queryParams);')

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Conflit résolu.')
PYEOF

say "2/2 → Build de vérification"
npm run build

echo ""
echo -e "${GREEN}✅ Le build passe ! On peut push.${NC}"
