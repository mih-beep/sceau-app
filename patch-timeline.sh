#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API Timeline (Remplace Pulse ou s'ajoute)
# ==========================================================
say "1/2 → API /api/verify/timeline"

mkdir -p "src/app/api/verify/timeline"
cat > "src/app/api/verify/timeline/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const isLive = searchParams.get('live') === 'true';

  try {
    let sql = `
      SELECT s.id, s.title, s.category, s.timestamp, u.handle as author
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.is_public = TRUE
    `;
    const params: any[] = [];

    if (isLive) {
      // Mode direct : on prend les 20 derniers
      sql += ` ORDER BY s.timestamp DESC LIMIT 20`;
    } else {
      // Mode période : filtré par dates
      if (start) {
        sql += ` AND s.timestamp >= $${params.length + 1}`;
        params.push(new Date(start));
      }
      if (end) {
        sql += ` AND s.timestamp <= $${params.length + 1}`;
        params.push(new Date(end));
      }
      sql += ` ORDER BY s.timestamp DESC LIMIT 50`;
    }

    const result = await pool.query(sql, params);
    return NextResponse.json({ timeline: result.rows });
  } catch (e) {
    console.error('[timeline]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF

# ==========================================================
# 2. UI Frise dans Verifier
# ==========================================================
say "2/2 → Mise à jour UI /verify (Frise Chronologique)"

python3 - << 'PYEOF'
import sys
p = 'src/app/verify/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier verify/page.tsx introuvable')

# A. Remplacer l'onglet "Pouls" par "Frise"
s = s.replace("🌍 Pouls", "📅 Frise")
s = s.replace("setTab('pulse')", "setTab('timeline')")
s = s.replace("tab==='pulse'", "tab==='timeline'")
s = s.replace("tab === 'pulse'", "tab === 'timeline'")
s = s.replace("setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='timeline'?'bg-[#E76F51] text-white shadow':'opacity-50'}`} style={{color: tab==='timeline' ? '#FFF' : 'var(--text-main)'}}", "setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='timeline'?'bg-[#E76F51] text-white shadow':'opacity-50'}`} style={{color: tab==='timeline' ? '#FFF' : 'var(--text-main)'}}")

# B. Modifier les states
old_states = """  const [pulseData, setPulseData] = useState<any[]>([]);
  const [pulseLoading, setPulseLoading] = useState(true);"""
new_states = """  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineMode, setTimelineMode] = useState<'live' | 'period'>('live');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');"""
if old_states in s: s = s.replace(old_states, new_states)

# C. Modifier le useEffect
old_effect = """  useEffect(() => {
    if (tab !== 'pulse') return;
    const fetchPulse = () => {
      fetch('/api/verify/pulse').then(res => res.json()).then(data => {
        setPulseData(data.pulse || []);
        setPulseLoading(false);
      });
    };
    fetchPulse();
    const interval = setInterval(fetchPulse, 5000);
    return () => clearInterval(interval);
  }, [tab]);"""
new_effect = """  useEffect(() => {
    if (tab !== 'timeline') return;
    const fetchTimeline = () => {
      setTimelineLoading(true);
      const url = timelineMode === 'live' 
        ? '/api/verify/timeline?live=true'
        : `/api/verify/timeline?start=${startDate}&end=${endDate}`;
        
      fetch(url).then(res => res.json()).then(data => {
        setTimelineData(data.timeline || []);
        setTimelineLoading(false);
      });
    };
    fetchTimeline();
    if (timelineMode === 'live') {
      const interval = setInterval(fetchTimeline, 5000);
      return () => clearInterval(interval);
    }
  }, [tab, timelineMode, startDate, endDate]);"""
if old_effect in s: s = s.replace(old_effect, new_effect)

# D. Remplacer la vue de l'onglet Pulse par la frise
old_pulse = """      {tab === 'timeline' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4 text-xs font-mono text-[#7A9B5A] justify-end">
            <span className="w-2 h-2 rounded-full bg-[#7A9B5A] animate-pulse"></span> Connexion en direct
          </div>
          {pulseLoading ? (
            <p className="text-center font-mono text-[var(--text-muted)] py-10">Connexion au réseau...</p>
          ) : pulseData.length === 0 ? (
            <p className="text-center italic text-[var(--text-muted)]">Le réseau est calme...</p>
          ) : (
            <div className="grid gap-3">
              {pulseData.map((item) => (
                <div key={item.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl shadow-sm flex items-center justify-between animate-fade-in">
                  <div>
                    <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{item.title}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Par <span className="font-bold text-[#E76F51]">@{item.author}</span> {item.location && `📍 ${item.location}`}
                    </div>
                  </div>
                  <div className="text-xs font-mono font-bold bg-[var(--bg-main)] px-2 py-1 rounded text-[var(--text-muted)]">
                    {timeAgo(item.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}"""

new_timeline = """      {tab === 'timeline' && (
        <div className="space-y-5">
          
          {/* Filtres de la frise */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3 flex flex-col gap-3">
            <div className="flex bg-[var(--bg-main)] p-1 rounded-lg">
              <button onClick={() => setTimelineMode('live')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${timelineMode === 'live' ? 'bg-white shadow text-[#E76F51]' : 'opacity-50'}`}>En direct</button>
              <button onClick={() => setTimelineMode('period')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${timelineMode === 'period' ? 'bg-white shadow text-[#E76F51]' : 'opacity-50'}`}>Par période</button>
            </div>
            
            {timelineMode === 'period' && (
              <div className="flex gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 border border-[var(--border-color)] rounded-lg p-2 text-xs bg-transparent" style={{color: 'var(--text-main)'}} />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 border border-[var(--border-color)] rounded-lg p-2 text-xs bg-transparent" style={{color: 'var(--text-main)'}} />
              </div>
            )}
          </div>

          {timelineLoading ? (
            <p className="text-center font-mono text-[var(--text-muted)] py-10">Synchronisation...</p>
          ) : timelineData.length === 0 ? (
            <p className="text-center italic text-[var(--text-muted)] py-10">Aucun sceau sur cette période.</p>
          ) : (
            <div className="relative pl-6">
              {/* La ligne verticale */}
              <div className="absolute left-2.5 top-2 bottom-0 w-0.5 bg-[#E76F51] opacity-30"></div>

              <div className="space-y-6">
                {timelineData.map((item, index) => (
                  <div key={item.id} className="relative animate-fade-in">
                    {/* Le point */}
                    <div className="absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full bg-[#E76F51] border-2 border-[var(--bg-main)] shadow-sm"></div>
                    
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-3 rounded-xl shadow-sm hover:border-[#E76F51] transition">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-xs" style={{color: 'var(--text-main)'}}>@{item.author}</span>
                        <span className="text-[0.6rem] font-mono text-[var(--text-muted)]">{timeAgo(item.timestamp)}</span>
                      </div>
                      <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{item.title}</div>
                      <div className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-1">{item.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}"""
if old_pulse in s: s = s.replace(old_pulse, new_timeline)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ UI Vérifier mise à jour avec la frise chronologique.')
PYEOF
