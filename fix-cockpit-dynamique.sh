#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API Activité globale (Journal d'accès du Cockpit)
# ==========================================================
say "1/3 → Création de l'API /api/profil/activity"

mkdir -p "src/app/api/profil/activity"
cat > "src/app/api/profil/activity/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ activities: [] });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ activities: [] });
    const userId = user.rows[0].id;

    const res = await pool.query(`
      SELECT 
        a.action,
        a.context,
        a.created_at,
        u.handle as viewer_handle,
        u.created_at as viewer_created_at,
        s.title as seal_title,
        s.id as seal_id
      FROM access_log a
      JOIN seals s ON a.seal_id = s.id
      JOIN users u ON a.viewer_id = u.id
      WHERE s.author_id = $1
      ORDER BY a.created_at DESC
      LIMIT 5
    `, [userId]);

    const activities = res.rows.map((r: any) => {
      const daysOld = Math.floor((Date.now() - new Date(r.viewer_created_at).getTime()) / 86400000);
      return {
        action: r.action,
        context: r.context,
        viewer: r.viewer_handle,
        seal_title: r.seal_title,
        seal_id: r.seal_id,
        created_at: r.created_at,
        is_new_account: daysOld < 7,
        days_old: daysOld,
      };
    });

    return NextResponse.json({ activities });
  } catch (e) {
    return NextResponse.json({ activities: [] });
  }
}
EOF

# ==========================================================
# 2. API Profil : Ajouter le nombre d'amis (équipe)
# ==========================================================
say "2/3 → API Profil (Nombre d'amis pour l'équipe)"

python3 - << 'PYEOF'
import sys
p = 'src/app/api/profil/route.ts'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier introuvable')

# Ajouter le count d'amis
if "friends_count" not in s:
    old_pacts = """    const pacts = await pool.query("SELECT COUNT(*) as total_pacts FROM pact_signatures WHERE user_id = $1", [userId]);"""
    new_pacts = """    const pacts = await pool.query("SELECT COUNT(*) as total_pacts FROM pact_signatures WHERE user_id = $1", [userId]);

    const friendsRes = await pool.query(`
      SELECT COUNT(*) as count FROM friendships 
      WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
    `, [userId]);
    const friendsCount = parseInt(friendsRes.rows[0].count || 0);"""
    
    s = s.replace(old_pacts, new_pacts)
    
    # Ajouter dans le return
    s = s.replace(
        "      used_bytes: parseInt(stats.rows[0].total_size || 0),",
        "      used_bytes: parseInt(stats.rows[0].total_size || 0),\n      friends_count: friendsCount,"
    )
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ friends_count ajouté à l\'API profil')
else:
    print('  ✓ friends_count déjà présent')
PYEOF

# ==========================================================
# 3. Cockpit : Tout dynamique
# ==========================================================
say "3/3 → Cockpit (100% dynamique)"

cat > src/components/Cockpit.tsx << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Cockpit() {
  const [handle, setHandle] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [pendingPacts, setPendingPacts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = localStorage.getItem('sceau_handle');
    const pubkey = localStorage.getItem('sceau_pubkey');
    setHandle(h);

    if (!pubkey) { setLoading(false); return; }

    // Profil
    fetch(`/api/profil?pubkey=${encodeURIComponent(pubkey)}`)
      .then(r => r.json())
      .then(d => { if (d.handle) setProfile(d); })
      .catch(() => {});

    // Activité (rafraîchie toutes les 30s)
    const fetchActivity = () => {
      fetch(`/api/profil/activity?pubkey=${encodeURIComponent(pubkey)}`)
        .then(r => r.json())
        .then(d => setActivities(d.activities || []))
        .catch(() => {});
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);

    // Pactes en attente
    fetch(`/api/pacts/pending?pubkey=${encodeURIComponent(pubkey)}`)
      .then(r => r.json())
      .then(d => setPendingPacts(d.count || 0))
      .catch(() => {});

    setLoading(false);
    return () => clearInterval(interval);
  }, []);

  // Stockage dynamique
  const maxQuotaGB = 0.1; // 100 Mo Free
  const usedBytes = profile?.used_bytes || 0;
  const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const percentage = Math.min(100, (parseFloat(usedGB) / maxQuotaGB) * 100);

  // Équipe dynamique (toi + amis)
  const teamCount = 1 + (profile?.friends_count || 0);
  const teamMax = 1; // Free = 1 siège, PRO = 5

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return "à l'instant";
    if (diff < 60) return `il y a ${diff} min`;
    if (diff < 1440) return `il y a ${Math.floor(diff/60)}h`;
    return `il y a ${Math.floor(diff/1440)}j`;
  }

  return (
    <aside className="hidden lg:flex flex-col w-[340px] bg-[var(--bg-main)] border-l border-[var(--border-color)] h-full overflow-y-auto shrink-0">
      
      {/* BLOC 1 : STATUT & QUOTAS RÉELS */}
      <div className="p-6 border-b border-[var(--border-color)]">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">Mon Espace Pro</h3>
        
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm mb-4">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-bold text-[var(--text-main)]">Stockage</span>
            <span className="text-xs font-mono text-[var(--text-muted)]">{usedGB} Go / {maxQuotaGB} Go</span>
          </div>
          <div className="w-full bg-[var(--border-color)] rounded-full h-2 mb-4 overflow-hidden">
            <div className={`h-2 rounded-full ${percentage > 90 ? 'bg-red-500' : 'bg-[#4A90C2]'}`} style={{ width: `${percentage}%` }}></div>
          </div>
          
          <div className="flex justify-between text-xs border-t border-[var(--border-color)] pt-3">
            <div>
              <p className="font-bold text-[var(--text-main)]">{profile?.sealed || 0}</p>
              <p className="text-[var(--text-muted)]">Sceaux au total</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[var(--text-main)]">Équipe</p>
              <Link href="/friends" className="text-[var(--orange)] hover:underline">{teamCount} / {teamMax} siège{teamCount > 1 ? 's' : ''}</Link>
            </div>
          </div>
        </div>

        {profile && (
          <Link href="/profil" className="w-full bg-[#F0F6FC] border border-[#C9D8E8] text-[#2D6A9E] py-2 rounded-lg text-xs font-bold hover:bg-[#E0EDF8] transition flex items-center justify-center gap-2">
            📩 Mon profil complet
          </Link>
        )}
      </div>

      {/* BLOC 2 : JOURNAL D'ACCÈS (Traqueur DYNAMIQUE) */}
      <div className="p-6 border-b border-[var(--border-color)] flex-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">Traqueur d'accès</h3>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>

        <div className="space-y-3">
          {!handle ? (
            <p className="text-xs text-[var(--text-muted)] italic">Connectez-vous pour voir l'activité.</p>
          ) : loading ? (
            <p className="text-xs text-[var(--text-muted)] italic">Chargement...</p>
          ) : activities.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic">Aucun accès récent. Partagez vos œuvres pour voir l'activité ici.</p>
          ) : (
            activities.map((a, i) => (
              <Link 
                key={i} 
                href={`/o/${a.seal_id}`}
                className={`block p-3 rounded-xl border transition hover:border-[var(--orange)] ${a.is_new_account ? 'bg-[#FDF4F0] border-[#FCE0D6]' : 'bg-[var(--bg-surface)] border-[var(--border-color)]'}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{a.action === 'download' ? '⬇️' : '👁️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${a.is_new_account ? 'text-[#C44A2E]' : 'text-[var(--text-main)]'}`}>
                      @{a.viewer} {a.action === 'download' ? 'a téléchargé' : 'a vu'}{' '}
                      <span className="italic">"{a.seal_title?.slice(0, 25)}..."</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[0.65rem] text-[var(--text-muted)]">{timeAgo(a.created_at)}</p>
                      {a.is_new_account && (
                        <span className="text-[0.55rem] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">Nouveau compte</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
        {handle && activities.length > 0 && (
          <Link href="/profil" className="block w-full mt-4 text-xs font-bold text-[#4A90C2] hover:underline text-center">
            Voir tout le journal des accès →
          </Link>
        )}
      </div>

      {/* BLOC 3 : PLAN DE TRAVAIL DYNAMIQUE */}
      <div className="p-6 bg-[var(--bg-surface)] border-t border-[var(--border-color)]">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">À faire</h3>
        <div className="space-y-2 mb-6">
          <Link href="/messages" className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-main)] transition group">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤝</span>
              <span className="text-sm font-bold text-[var(--text-main)]">
                {pendingPacts > 0 ? `${pendingPacts} Pacte${pendingPacts > 1 ? 's' : ''} en attente` : 'Aucun pacte en attente'}
              </span>
            </div>
            <span className="text-[var(--text-muted)] group-hover:text-[var(--orange)]">→</span>
          </Link>

          <Link href="/settings" className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-main)] transition group">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔌</span>
              <span className="text-sm font-bold text-[var(--text-main)]">Connecter un plugin</span>
            </div>
            <span className="text-[var(--text-muted)] group-hover:text-[var(--orange)]">→</span>
          </Link>
        </div>

        <div className="bg-gradient-to-br from-[#2D2421] to-black p-4 rounded-xl text-center shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-white font-bold text-sm mb-1">SCEAU PRO</p>
            <p className="text-[0.65rem] text-gray-400 mb-3">Débloquez l'illimité.</p>
            <Link href="/pricing" className="inline-block bg-[var(--orange)] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[var(--orange-hover)] transition">
              Mettre à niveau
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
EOF

echo ""
echo -e "${GREEN}✅ Cockpit 100% dynamique. Vérification du build...${NC}"
npm run build
