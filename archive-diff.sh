#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Modification de l'API (Génération du Diff Textuel)"

cat > "src/app/api/archive/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';

export const runtime = 'nodejs';
export const maxDuration = 30;

function hashContent(content: string): string {
  const hash = sha256(new TextEncoder().encode(content));
  return Buffer.from(hash).toString('hex');
}

// Fonction basique de Diff (Ligne par ligne, sans IA)
function generateDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];

  const maxLines = Math.max(oldLines.length, newLines.length);
  let changesCount = 0;

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine !== newLine) {
      diff.push({ type: 'removed', text: oldLine.trim() });
      diff.push({ type: 'added', text: newLine.trim() });
      changesCount++;
    } else if (oldLine.trim() !== '') {
      // On garde les lignes identiques pour le contexte (max 3 par bloc)
      diff.push({ type: 'unchanged', text: oldLine.trim() });
    }
  }

  return { changesCount, details: diff.slice(0, 100) }; // On limite à 100 lignes pour l'affichage
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

  try {
    const user = await pool.query("SELECT id, is_pro FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    
    const result = await pool.query(`
      SELECT id, url, title, last_status, last_checked_at, created_at, diff_data
      FROM web_archives WHERE user_id = $1 ORDER BY created_at DESC
    `, [user.rows[0].id]);
    
    return NextResponse.json({ 
      archives: result.rows, 
      is_pro: user.rows[0].is_pro,
      limit: user.rows[0].is_pro ? 50 : 3
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { pubkey, url, action } = await req.json();
  if (!pubkey || !url) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id, is_pro FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    
    const userId = user.rows[0].id;
    const isPro = user.rows[0].is_pro;

    const countQuery = await pool.query("SELECT COUNT(*) as count FROM web_archives WHERE user_id = $1", [userId]);
    const currentCount = parseInt(countQuery.rows[0].count);
    const maxLimit = isPro ? 50 : 3;

    if (currentCount >= maxLimit && action !== 'check') {
      return NextResponse.json({ error: `Quota atteint (${maxLimit} URLs max).` }, { status: 403 });
    }

    // === VÉRIFICATION (Le Scan) ===
    if (action === 'check') {
      const archive = await pool.query("SELECT id, url, last_hash, last_content FROM web_archives WHERE id = $1 AND user_id = $2", [url, userId]);
      if (archive.rows.length === 0) return NextResponse.json({ error: 'Archive introuvable' }, { status: 404 });
      
      const targetUrl = archive.rows[0].url;
      const oldHash = archive.rows[0].last_hash;
      const oldContent = archive.rows[0].last_content || '';

      const res = await fetch(targetUrl, { headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' } });
      const html = await res.text();
      
      // On extrait le texte brut (sans les balises HTML pour un diff propre)
      const newText = html.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n').trim();
      const newHash = hashContent(newText);

      const isModified = oldHash !== newHash;
      
      if (isModified) {
        const diffResult = generateDiff(oldContent, newText);
        await pool.query(
          "UPDATE web_archives SET last_status = 'modified', last_checked_at = NOW(), diff_data = $1 WHERE id = $2", 
          [JSON.stringify(diffResult), url]
        );
        return NextResponse.json({ status: 'modified', changes: diffResult.changesCount });
      } else {
        await pool.query("UPDATE web_archives SET last_status = 'intact', last_checked_at = NOW(), diff_data = NULL WHERE id = $1", [url]);
        return NextResponse.json({ status: 'intact' });
      }
    }

    // === AJOUT D'UNE NOUVELLE URL ===
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
    }

    const res = await fetch(url, { headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' } });
    if (!res.ok) return NextResponse.json({ error: 'Impossible de joindre le site.' }, { status: 400 });
    
    const html = await res.text();
    const cleanText = html.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n').trim();
    const newHash = hashContent(cleanText);
    const title = new URL(url).hostname;

    await pool.query(`
      INSERT INTO web_archives (user_id, url, title, last_hash, last_content, last_status) 
      VALUES ($1, $2, $3, $4, $5, 'intact')
    `, [userId, url, title, newHash, cleanText]);

    return NextResponse.json({ success: true });

  } catch (e: any) {
    return NextResponse.json({ error: 'Erreur : ' + e.message }, { status: 500 });
  }
}
EOF

say "2/2 → Modification de l'UI (Affichage du Diff Git-Like)"

cat > "src/app/archive/page.tsx" << 'EOF'
'use client';
import { useEffect, useState } from 'react';

export default function ArchivePage() {
  const [archives, setArchives] = useState<any[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState(3);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<any>(null);

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadArchives = async () => {
    if (!pubkey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      if (res.ok) {
        setArchives(d.archives || []);
        setIsPro(d.is_pro);
        setLimit(d.limit);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchives(); }, [pubkey]);

  async function handleAdd() {
    if (!url || !pubkey) return;
    setAdding(true); setError('');
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url })
    });
    const d = await res.json();
    if (!res.ok) setError(d.error);
    else { setUrl(''); loadArchives(); }
    setAdding(false);
  }

  async function checkUrl(id: string) {
    if (!pubkey) return;
    setChecking(id);
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url: id, action: 'check' })
    });
    const d = await res.json();
    if (res.ok) {
      if (d.status === 'modified') {
        alert(`Modification détectée ! ${d.changes} changements trouvés.`);
      }
      loadArchives();
    }
    else alert(d.error);
    setChecking(null);
  }

  async function deleteUrl(id: string) {
    if (!pubkey || !confirm('Supprimer cette surveillance ?')) return;
    await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}&id=${id}`, { method: 'DELETE' });
    loadArchives();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans w-full min-h-screen">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Archive</h1>
          <p className="text-sm text-[var(--text-muted)]">Surveillez l'intégrité des sites web. Détectez les modifications en un clic.</p>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-8">
        <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 font-mono uppercase">Ajouter une URL à surveiller</label>
        <div className="flex gap-2">
          <input 
            type="url" 
            placeholder="https://www.concurrent.com" 
            className="flex-1 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2]"
            style={{color: 'var(--text-main)'}}
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button 
            onClick={handleAdd} 
            disabled={adding || (!isPro && archives.length >= limit)}
            className="bg-[#1A1513] text-white px-6 rounded-xl font-bold disabled:opacity-50 hover:bg-black transition"
          >
            {adding ? '...' : 'Sceller'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
        {!isPro && archives.length >= limit && (
          <p className="text-sm text-[#C44A2E] mt-3 font-bold">
            ⚠️ Limite de 3 URLs atteinte. Passez à PRO pour en ajouter plus.
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-center font-mono py-10">Chargement...</p>
      ) : archives.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl">
          <p className="text-[var(--text-muted)] italic">Vous ne surveillez aucun site pour le moment.</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
          {archives.map((a, i) => (
            <div key={a.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 ${i !== archives.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${a.last_status === 'modified' ? 'bg-[#FDF4F0]' : ''}`}>
              
              <div className="flex items-center gap-3 mb-3 md:mb-0">
                <div className={`w-2 h-2 rounded-full ${a.last_status === 'modified' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div>
                  <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{a.title || a.url}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate max-w-[300px]">{a.url}</p>
                  {a.last_status === 'modified' && <p className="text-[0.65rem] text-red-600 font-bold uppercase mt-1">Modification détectée</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {a.diff_data && (
                  <button onClick={() => setSelectedDiff(a.diff_data)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition shadow-sm">
                    Voir le Diff
                  </button>
                )}
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">
                  Vérifié le {new Date(a.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
                <button 
                  onClick={() => checkUrl(a.id)} 
                  disabled={checking === a.id}
                  className="bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#E0EDF8] transition"
                >
                  {checking === a.id ? 'Scan...' : 'Vérifier'}
                </button>
                <button onClick={() => deleteUrl(a.id)} className="text-red-400 hover:text-red-600 px-2 text-lg">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALE DE DIFF GIT-LIKE */}
      {selectedDiff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 font-mono text-sm">Diff de la page (Comparaison)</h3>
              <button onClick={() => setSelectedDiff(null)} className="text-gray-500 hover:text-black font-bold text-xl">✕</button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs bg-gray-50">
              {selectedDiff.details?.map((line: any, i: number) => (
                <div key={i} className={`py-1 px-2 whitespace-pre-wrap ${
                  line.type === 'added' ? 'bg-green-100 text-green-800 border-l-2 border-green-500' :
                  line.type === 'removed' ? 'bg-red-100 text-red-800 border-l-2 border-red-500 line-through opacity-70' :
                  'text-gray-500'
                }`}>
                  <span className="select-none opacity-50 mr-2">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                  {line.text || ' '}
                </div>
              ))}
              {!selectedDiff.details?.length && <p className="text-gray-500 italic text-center">Aucune différence textuelle visible.</p>}
            </div>
            <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
              <span className="text-xs text-gray-500">Total : {selectedDiff.changesCount} modifications</span>
              <button onClick={() => setSelectedDiff(null)} className="bg-black text-white px-6 py-2 rounded-lg font-bold text-sm">Fermer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
EOF

say "3/3 → Nettoyage et Build"
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ SCEAU Archive est prêt avec le vrai Diff Git-like !${NC}"
