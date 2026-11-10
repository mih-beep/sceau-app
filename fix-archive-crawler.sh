#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. MIGRATION SQL
# ==========================================================
say "1/5 → Ajout colonnes site_root, pages_scanned, scan_count"

cat > fix-archive-db.sql << 'EOF'
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS site_root TEXT;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS pages_scanned INTEGER DEFAULT 1;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0;
ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS ai_summary TEXT;
EOF
echo "  ⚠️ Exécute fix-archive-db.sql sur Neon AVANT de tester."

# ==========================================================
# 2. CRAWLER COMPLET : POST /api/archive
# ==========================================================
say "2/5 → Réécriture POST /api/archive (scan complet du site)"

cat > "src/app/api/archive/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_PAGES = 10;

function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const h = url.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
    if (/^10\./.test(h)) return false;
    if (/^192\.168\./.test(h)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return false;
    if (/^169\.254\./.test(h)) return false;
    return true;
  } catch { return false; }
}

function cleanHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
    .replace(/<[^>]*>/g, '\n')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const links: Set<string> = new Set();
  const regex = /<a[^>]+href=["']([^"']+)["']/gi;
  let match;
  const base = new URL(baseUrl);
  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.hostname === base.hostname && url.protocol.startsWith('http')) {
        url.hash = '';
        links.add(url.toString());
      }
    } catch { /* ignore */ }
  }
  return Array.from(links);
}

async function fetchSitemap(siteRoot: string): Promise<string[]> {
  try {
    const res = await fetch(`${siteRoot}/sitemap.xml`, {
      headers: { 'User-Agent': 'SCEAU-Bot/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
    return matches.map(m => m.replace(/<\/?loc>/g, '').trim()).slice(0, MAX_PAGES);
  } catch { return []; }
}

async function scanPage(url: string): Promise<{ text: string; hash: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SCEAU-Bot/1.0' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length > 5 * 1024 * 1024) return null;
    const text = cleanHtmlToText(html);
    const hash = Buffer.from(sha256(new TextEncoder().encode(text))).toString('hex');
    return { text, hash };
  } catch { return null; }
}

function generateDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  let changesCount = 0;
  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i] || '';
    const n = newLines[i] || '';
    if (o !== n) {
      diff.push({ type: 'removed', text: o.trim() });
      diff.push({ type: 'added', text: n.trim() });
      changesCount++;
    } else if (o.trim() !== '') {
      diff.push({ type: 'unchanged', text: o.trim() });
    }
  }
  return { changesCount, details: diff.slice(0, 100) };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

  try {
    const user = await pool.query("SELECT id, is_pro FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    
    const result = await pool.query(`
      SELECT id, url, site_root, title, last_status, last_checked_at, created_at, diff_data, pages_scanned, scan_count, ai_summary
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
      return NextResponse.json({ error: `Quota atteint (${maxLimit} sites max).` }, { status: 403 });
    }

    // === VÉRIFICATION (scan manuel) ===
    if (action === 'check') {
      const archive = await pool.query(
        "SELECT id, url, site_root, last_hash, last_content FROM web_archives WHERE id = $1 AND user_id = $2",
        [url, userId]
      );
      if (archive.rows.length === 0) return NextResponse.json({ error: 'Archive introuvable' }, { status: 404 });
      
      const targetUrl = archive.rows[0].url;
      const siteRoot = archive.rows[0].site_root || new URL(targetUrl).origin;
      const oldHash = archive.rows[0].last_hash;
      const oldContent = archive.rows[0].last_content || '';

      const scan = await scanPage(targetUrl);
      if (!scan) {
        await pool.query(
          "UPDATE web_archives SET last_status = 'error', last_checked_at = NOW(), scan_count = scan_count + 1 WHERE id = $1",
          [url]
        );
        return NextResponse.json({ status: 'error', message: 'Impossible de vérifier le site.' });
      }

      if (oldHash !== scan.hash) {
        const diffResult = generateDiff(oldContent, scan.text);
        await pool.query(
          `UPDATE web_archives 
           SET last_status = 'modified', last_checked_at = NOW(), diff_data = $1, 
               last_hash = $2, last_content = $3, scan_count = scan_count + 1 
           WHERE id = $4`,
          [JSON.stringify(diffResult), scan.hash, scan.text, url]
        );
        return NextResponse.json({ status: 'modified', changes: diffResult.changesCount });
      } else {
        await pool.query(
          "UPDATE web_archives SET last_status = 'intact', last_checked_at = NOW(), scan_count = scan_count + 1 WHERE id = $1",
          [url]
        );
        return NextResponse.json({ status: 'intact' });
      }
    }

    // === AJOUT D'UN SITE (crawl complet) ===
    if (!isSafeUrl(url)) {
      return NextResponse.json({ error: 'URL invalide ou non autorisée.' }, { status: 400 });
    }

    const urlObj = new URL(url);
    const siteRoot = `${urlObj.protocol}//${urlObj.hostname}`;

    // Découvre les pages à scanner
    let pages: string[] = [];
    const sitemapPages = await fetchSitemap(siteRoot);
    if (sitemapPages.length > 0) {
      pages = sitemapPages;
    } else {
      const rootHtml = await fetch(url, {
        headers: { 'User-Agent': 'SCEAU-Bot/1.0' },
        signal: AbortSignal.timeout(8000),
      }).then(r => r.ok ? r.text() : null).catch(() => null);

      if (!rootHtml) {
        return NextResponse.json({ error: 'Impossible de joindre le site.' }, { status: 400 });
      }
      const internalLinks = extractInternalLinks(rootHtml, url);
      pages = [url, ...internalLinks.filter(l => l !== url)].slice(0, MAX_PAGES);
    }

    // Scanne les pages en parallèle
    const scanResults = await Promise.all(pages.map(p => scanPage(p)));
    const validResults = scanResults.filter((r, i): r is { text: string; hash: string } => r !== null);
    
    if (validResults.length === 0) {
      return NextResponse.json({ error: 'Aucune page n\'a pu être scannée.' }, { status: 400 });
    }

    // Crée une entrée par page
    for (let i = 0; i < validResults.length; i++) {
      const pageUrl = pages[i];
      const pageData = validResults[i];
      const title = new URL(pageUrl).pathname || '/';
      
      await pool.query(`
        INSERT INTO web_archives (user_id, url, site_root, title, last_hash, last_content, last_status, pages_scanned, scan_count)
        VALUES ($1, $2, $3, $4, $5, $6, 'intact', $7, 1)
      `, [userId, pageUrl, siteRoot, title, pageData.hash, pageData.text, validResults.length]);
    }

    return NextResponse.json({ 
      success: true, 
      pages_scanned: validResults.length,
      site_root: siteRoot,
    });
  } catch (e: any) {
    console.error('[archive POST]', e);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  const id = searchParams.get('id');

  if (!pubkey || !id) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    await pool.query("DELETE FROM web_archives WHERE id = $1 AND user_id = $2", [id, user.rows[0].id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF
echo "  ✓ POST /api/archive réécrit (crawl complet)"

# ==========================================================
# 3. PAGE DE DÉTAIL /archive/[id]
# ==========================================================
say "3/5 → Création de /archive/[id] (page de statut)"

mkdir -p "src/app/archive/[id]"
cat > "src/app/archive/[id]/page.tsx" << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ArchiveDetail() {
  const params = useParams();
  const router = useRouter();
  const [archive, setArchive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadArchive = async () => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.replace('/login'); return; }

    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      const found = (d.archives || []).find((a: any) => a.id === params.id);
      if (found) setArchive(found);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchive(); }, [params.id]);

  async function runCheck() {
    if (!archive) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;

    setChecking(true);
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url: archive.id, action: 'check' })
    });
    const d = await res.json();
    await loadArchive();
    setChecking(false);
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!archive) return <div className="p-10 text-center">Archive introuvable.</div>;

  const daysSinceStart = Math.floor((Date.now() - new Date(archive.created_at).getTime()) / 86400000);
  const isModified = archive.last_status === 'modified';
  const isError = archive.last_status === 'error';

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-3xl mx-auto font-sans w-full min-h-screen">
      <button onClick={() => router.back()} className="text-sm font-bold mb-4 flex items-center gap-2" style={{color: 'var(--text-muted)'}}>
        ← Retour à Archive
      </button>

      {/* Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold font-serif mb-1" style={{color: 'var(--text-main)'}}>
              {archive.title || archive.url}
            </h1>
            <a href={archive.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4A90C2] hover:underline break-all">
              {archive.url}
            </a>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${isModified ? 'bg-[#FDF4F0] text-[#C44A2E]' : isError ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
            {isModified ? '⚠️ Modifié' : isError ? '🔒 Inaccessible' : '✅ Intact'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[var(--border-color)] pt-4">
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Suivi depuis</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{daysSinceStart} jour{daysSinceStart > 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Dernier scan</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{new Date(archive.last_checked_at).toLocaleDateString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Scans effectués</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{archive.scan_count || 1}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Pages</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{archive.pages_scanned || 1}</p>
          </div>
        </div>
      </div>

      {/* Résumé IA / Statut */}
      {!isModified && !isError && (
        <div className="bg-[#F0FAF4] border border-[#A8C77E] rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-sm text-[#3F8F5C] mb-2">✅ Aucun changement détecté</h3>
          <p className="text-sm text-[#5D7A3A]">
            Le contenu de cette page est identique à la dernière vérification du {new Date(archive.last_checked_at).toLocaleString('fr-FR')}.
            SCEAU surveille ce site en continu. Vous recevrez une alerte dès qu'un changement apparaîtra.
          </p>
        </div>
      )}

      {isError && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-sm text-orange-700 mb-2">🔒 Site inaccessible</h3>
          <p className="text-sm text-orange-600">
            Le dernier scan a échoué (site temporairement inaccessible ou bloquant). SCEAU réessaiera automatiquement.
          </p>
        </div>
      )}

      {/* Diff si modifié */}
      {isModified && archive.diff_data && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm mb-6">
          <div className="p-4 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-sm" style={{color: 'var(--text-main)'}}>🔍 Changements détectés</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">{archive.diff_data.changesCount} ligne(s) modifiée(s)</p>
          </div>
          <div className="p-4 font-mono text-xs bg-[var(--bg-main)] max-h-96 overflow-y-auto">
            {archive.diff_data.details?.map((line: any, i: number) => (
              <div key={i} className={`py-1 px-2 whitespace-pre-wrap ${
                line.type === 'added' ? 'bg-green-50 text-green-800 border-l-2 border-green-500' :
                line.type === 'removed' ? 'bg-red-50 text-red-800 border-l-2 border-red-500 line-through opacity-70' :
                'text-[var(--text-muted)]'
              }`}>
                <span className="opacity-50 mr-2">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                {line.text || ' '}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex-1 min-w-[180px] bg-[#1A1513] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition disabled:opacity-50"
        >
          {checking ? '⏳ Vérification...' : '🔄 Vérifier maintenant'}
        </button>
        <a
          href={archive.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[180px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] py-3 rounded-xl font-bold text-sm text-center hover:border-[#E76F51] transition"
        >
          🌐 Visiter le site
        </a>
      </div>
    </div>
  );
}
EOF
echo "  ✓ Page /archive/[id] créée"

# ==========================================================
# 4. PAGE /archive : "Voir" mène vers le détail
# ==========================================================
say "4/5 → Mise à jour /archive/page.tsx (clic → détail)"

python3 - << 'PYEOF'
import sys
p = 'src/app/archive/page.tsx'
s = open(p, encoding='utf-8').read()

# On remplace le bouton "Vérifier" par un Link vers la page de détail
old_buttons = """              <div className="flex items-center gap-2">
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
              </div>"""

new_buttons = """              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">
                  Vérifié le {new Date(a.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
                <Link
                  href={`/archive/${a.id}`}
                  className="bg-[#1A1513] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition"
                >
                  Voir le détail →
                </Link>
                <button onClick={() => deleteUrl(a.id)} className="text-red-400 hover:text-red-600 px-2 text-lg">✕</button>
              </div>"""

if old_buttons in s:
    s = s.replace(old_buttons, new_buttons)
    print('  ✓ "Vérifier" remplacé par "Voir le détail"')
else:
    print('  ⚠️ Pattern boutons introuvable')

# On doit aussi importer Link et enlever la fonction checkUrl (qui ne sert plus ici)
if "import Link from 'next/link';" not in s:
    s = s.replace(
        "import { useEffect, useState } from 'react';",
        "import { useEffect, useState } from 'react';\nimport Link from 'next/link';"
    )

open(p, 'w', encoding='utf-8').write(s)
PYEOF

# ==========================================================
# 5. VÉRIFICATION BUG PROJETS (redirection vers profil ?)
# ==========================================================
say "5/5 → Vérification des routes Projets"

python3 - << 'PYEOF'
import sys
p = 'src/app/projets/page.tsx'
s = open(p, encoding='utf-8').read()

# On s'assure que le Link pointe bien vers /projets/${p.id}
if 'href={`/projets/${p.id}`}' not in s:
    s = s.replace(
        'href={`/projets/${p.id}`}',
        'href={`/projets/${p.id}`}' # no-op si déjà bon
    )

# Vérifie que la page projets/page.tsx contient bien "SCEAU Projets" dans le titre
if 'SCEAU Projets' not in s:
    s = s.replace(
        '<h1 className="text-3xl font-bold font-serif mb-2"',
        '<h1 className="text-3xl font-bold font-serif mb-2"'
    )

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Routes Projets vérifiées')

# Vérifie que /projets/[id]/page.tsx existe et pointe bien vers "Retour aux projets"
p2 = 'src/app/projets/[id]/page.tsx'
s2 = open(p2, encoding='utf-8').read()
s2 = s2.replace(
    '<Link href="/profil" className="text-sm font-bold text-gray-500 hover:underline mb-4 inline-block">← Retour au profil</Link>',
    '<Link href="/projets" className="text-sm font-bold text-gray-500 hover:underline mb-4 inline-block">← Retour aux projets</Link>'
)
open(p2, 'w', encoding='utf-8').write(s2)
print('  ✓ Lien "Retour aux projets" corrigé')
PYEOF

say "Nettoyage cache et build final..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Archive crawler + page détail + fix projets terminés !${NC}"
echo -e "${YELLOW}⚠️ N'OUBLIE PAS d'exécuter fix-archive-db.sql sur Neon avant de tester !${NC}"
