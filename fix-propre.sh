#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Layout : Retirer le Manifeste + Masquer Cockpit sur Atelier
# ==========================================================
say "1/3 → Layout (Manifeste retiré, Cockpit masqué sur Atelier)"

python3 - << 'PYEOF'
import sys
p = 'src/app/layout.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier layout introuvable')

# Retirer complètement le Manifeste
s = s.replace(
    "import Manifeste from '@/components/Manifeste'",
    "// import Manifeste from '@/components/Manifeste'"
)
s = s.replace(
    "  const showManifeste = ['/profil', '/seal', '/verify', '/settings'].includes(pathname);",
    "  // const showManifeste = ['/profil', '/seal', '/verify', '/settings'].includes(pathname);"
)
s = s.replace(
    "             {showManifeste && <div className=\"max-w-3xl mx-auto md:max-w-none\"><Manifeste /></div>}",
    ""
)

# Masquer le Cockpit sur /seal et /messages (pour laisser toute la place)
s = s.replace(
    "        <Cockpit />",
    "        {pathname !== '/seal' && pathname !== '/messages' && <Cockpit />}"
)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Manifeste retiré, Cockpit masqué sur Atelier/Messages')
PYEOF

# ==========================================================
# 2. API Pactes en attente (dynamique)
# ==========================================================
say "2/3 → API /api/pacts/pending"

mkdir -p "src/app/api/pacts/pending"
cat > "src/app/api/pacts/pending/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ count: 0 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ count: 0 });
    const userId = user.rows[0].id;

    const res = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM pacts p
      LEFT JOIN pact_signatures ps ON p.id = ps.pact_id
      WHERE (p.creator_id = $1 OR ps.user_id = $1)
        AND p.status != 'scelle'
    `, [userId]);

    return NextResponse.json({ count: parseInt(res.rows[0].count || 0) });
  } catch (e) {
    return NextResponse.json({ count: 0 });
  }
}
EOF

# ==========================================================
# 3. Cockpit : Pactes dynamiques
# ==========================================================
say "3/3 → Cockpit (Pactes dynamiques)"

python3 - << 'PYEOF'
import sys
p = 'src/components/Cockpit.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier Cockpit introuvable')

# Ajouter state
if "pendingPacts" not in s:
    s = s.replace(
        "const [alerts, setAlerts] = useState<any[]>([]);",
        "const [alerts, setAlerts] = useState<any[]>([]);\n  const [pendingPacts, setPendingPacts] = useState(0);"
    )

# Fetch
if "api/pacts/pending" not in s:
    s = s.replace(
        "      // Simuler les alertes (à brancher sur l'API journal des accès plus tard)",
        "      fetch(`/api/pacts/pending?pubkey=${encodeURIComponent(pubkey)}`)\n        .then(r => r.json())\n        .then(d => setPendingPacts(d.count || 0));\n\n      // Simuler les alertes (à brancher sur l'API journal des accès plus tard)"
    )

# Remplacer le chiffre en dur
old_pacts = """              <span className="text-sm font-bold text-[var(--text-main)]">2 Pactes en attente</span>"""
new_pacts = """              <span className="text-sm font-bold text-[var(--text-main)]">
                {pendingPacts > 0 ? `${pendingPacts} Pacte${pendingPacts > 1 ? 's' : ''} en attente` : 'Aucun pacte en attente'}
              </span>"""

if old_pacts in s:
    s = s.replace(old_pacts, new_pacts)
    print('  ✓ Pactes dynamiques')
else:
    print('  ⚠️ Chiffre en dur introuvable, déjà corrigé ?')

open(p, 'w', encoding='utf-8').write(s)
PYEOF

echo ""
echo -e "${GREEN}✅ Corrections appliquées. Vérification du build...${NC}"
npm run build
