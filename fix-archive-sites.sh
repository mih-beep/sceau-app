#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. CRAWLER : extraction du vrai <title> + quota par site
# ==========================================================
say "1/4 → Réécriture POST /api/archive (quota par site + titre propre)"

cat > "src/app/api/archive/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_PAGES = 10;
const FREE_LIMIT = 5;  // Sites gratuits (pas pages)
const PRO_LIMIT = 50;

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

function extractPageTitle(html: string, fallbackUrl: string): string {
  // Cherche <title>...</title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const clean = titleMatch[1].replace(/\s+/g, ' ').trim();
    if (clean.length > 0 && clean.length < 200) return clean;
  }
  // Cherche <h1>...</h1>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    const clean = h1Match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length > 0 && clean.length < 100) return clean;
  }
  // Fallback : hostname + pathname
  try {
    const u = new URL(fallbackUrl);
    if (u.pathname === '/' || u.pathname === '') return u.hostname;
    return `${u.hostname}${u.pathname}`;
  } catch {
    return fallbackUrl;
  }
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
        url.search = ''; // ignore query strings pour éviter les doublons
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

async function scanPage(url: string): Promise<{ text: string; hash: string; title: string } | null> {
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
    const title = extractPageTitle(html, url);
    return { text, hash, title };
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
    const userId = user.rows[0].id;
    const isPro = user.rows[0].is_pro || false;

    // Récupère toutes les pages, puis regroupe par site_root côté serveur
    let pages;
    try {
      pages = await pool.query(`
        SELECT id, url, site_root, title, last_status, last_checked_at, created_at, diff_data, pages_scanned, scan_count, ai_summary
        FROM web_archives WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]);
    } catch (colErr) {
      // Fallback si colonnes manquantes
      pages = await pool.query(`
        SELECT id, url, title, last_status, last_checked_at, created_at, diff_data
        FROM web_archives WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]);
    }

    // Regroupement par site_root (site principal)
    const sitesMap = new Map<string, any>();
    for (const page of pages.rows) {
      const siteRoot = page.site_root || (() => {
        try { return new URL(page.url).origin; } catch { return page.url; }
      })();
      
      if (!sitesMap.has(siteRoot)) {
        sitesMap.set(siteRoot, {
          site_root: siteRoot,
          main_id: page.id,          // la page principale (première = l'URL ajoutée)
          main_title: page.site_root === null ? page.title : null, // à remplir
          main_url: page.url,
          pages_count: 0,
          last_checked_at: page.last_checked_at,
          created_at: page.created_at,
          scan_count: page.scan_count || 1,
          has_modifications: false,
          pages: [],
        });
      }
      
      const site = sitesMap.get(siteRoot);
      site.pages_count++;
      site.pages.push(page);
      
      // Le main_id doit être celui de la page racine (pathname === '/')
      try {
        const u = new URL(page.url);
        if (u.pathname === '/' || u.pathname === '') {
          site.main_id = page.id;
          site.main_title = page.title;
          site.main_url = page.url;
        }
      } catch { /* ignore */ }
      
      if (page.last_status === 'modified') site.has_modifications = true;
      if (new Date(page.last_checked_at) > new Date(site.last_checked_at)) {
        site.last_checked_at = page.last_checked_at;
      }
    }

    // Si le titre principal n'a pas été trouvé, fallback sur le hostname
    for (const site of sitesMap.values()) {
      if (!site.main_title) {
        try { site.main_title = new URL(site.site_root).hostname; }
        catch { site.main_title = site.site_root; }
      }
    }

    const sitesArray = Array.from(sitesMap.values());

    return NextResponse.json({ 
      archives: sitesArray, 
      is_pro: isPro,
      limit: isPro ? PRO_LIMIT : FREE_LIMIT,
      total_sites: sitesArray.length,
    });
  } catch (e) {
    console.error('[archive GET]', e);
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

    // === VÉRIFICATION (action 'check') ===
    if (action === 'check') {
      const archive = await pool.query(
        "SELECT id, url, last_hash, last_content FROM web_archives WHERE id = $1 AND user_id = $2",
        [url, userId]
      );
      if (archive.rows.length === 0) return NextResponse.json({ error: 'Archive introuvable' }, { status: 404 });
      
      const targetUrl = archive.rows[0].url;
      const oldHash = archive.rows[0].last_hash;
      const oldContent = archive.rows[0].last_content || '';

      const scan = await scanPage(targetUrl);
      if (!scan) {
        await pool.query(
          "UPDATE web_archives SET last_status = 'error', last_checked_at = NOW(), scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $1",
          [url]
        );
        return NextResponse.json({ status: 'error' });
      }

      if (oldHash !== scan.hash) {
        const diffResult = generateDiff(oldContent, scan.text);
        await pool.query(
          `UPDATE web_archives 
           SET last_status = 'modified', last_checked_at = NOW(), diff_data = $1, 
               last_hash = $2, last_content = $3, scan_count = COALESCE(scan_count, 0) + 1 
           WHERE id = $4`,
          [JSON.stringify(diffResult), scan.hash, scan.text, url]
        );
        return NextResponse.json({ status: 'modified', changes: diffResult.changesCount });
      } else {
        await pool.query(
          "UPDATE web_archives SET last_status = 'intact', last_checked_at = NOW(), scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $1",
          [url]
        );
        return NextResponse.json({ status: 'intact' });
      }
    }

    // === AJOUT D'UN NOUVEAU SITE ===
    if (!isSafeUrl(url)) {
      return NextResponse.json({ error: 'URL invalide ou non autorisée.' }, { status: 400 });
    }

    const urlObj = new URL(url);
    const siteRoot = `${urlObj.protocol}//${urlObj.hostname}`;

    // COMPTAGE PAR SITE (pas par page) : combien de sites distincts ?
    const sitesCountQuery = await pool.query(
      "SELECT COUNT(DISTINCT site_root) as count FROM web_archives WHERE user_id = $1 AND site_root IS NOT NULL",
      [userId]
    );
    const sitesCount = parseInt(sitesCountQuery.rows[0].count || 0);
    const maxLimit = isPro ? PRO_LIMIT : FREE_LIMIT;

    // Vérifie si ce site existe déjà
    const existingSite = await pool.query(
      "SELECT id FROM web_archives WHERE user_id = $1 AND site_root = $2 LIMIT 1",
      [userId, siteRoot]
    );

    if (existingSite.rows.length === 0 && sitesCount >= maxLimit) {
      return NextResponse.json({ 
        error: `Quota atteint (${maxLimit} sites max). Passez à SCEAU PRO pour en ajouter plus.` 
      }, { status: 403 });
    }

    // Si le site existe déjà, on ajoute juste les nouvelles pages
    // Sinon, on crawle comme d'habitude

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

    const scanResults = await Promise.all(pages.map(p => scanPage(p)));
    
    let insertedCount = 0;
    for (let i = 0; i < pages.length; i++) {
      const pageUrl = pages[i];
      const pageData = scanResults[i];
      if (!pageData) continue;
      
      // Vérifie si cette page existe déjà
      const existing = await pool.query(
        "SELECT id FROM web_archives WHERE user_id = $1 AND url = $2",
        [userId, pageUrl]
      );
      
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO web_archives (user_id, url, site_root, title, last_hash, last_content, last_status, pages_scanned, scan_count)
          VALUES ($1, $2, $3, $4, $5, $6, 'intact', $7, 1)
        `, [userId, pageUrl, siteRoot, pageData.title, pageData.hash, pageData.text, pages.length]);
        insertedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      pages_scanned: insertedCount,
      total_pages: pages.length,
      site_root: siteRoot,
    });
  } catch (e: any) {
    console.error('[archive POST]', e);
    return NextResponse.json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
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

    // Si c'est un site entier, on supprime toutes ses pages
    const site = await pool.query(
      "SELECT site_root FROM web_archives WHERE id = $1 AND user_id = $2",
      [id, user.rows[0].id]
    );
    
    if (site.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    if (site.rows[0].site_root) {
      await pool.query(
        "DELETE FROM web_archives WHERE user_id = $1 AND site_root = $2",
        [user.rows[0].id, site.rows[0].site_root]
      );
    } else {
      await pool.query("DELETE FROM web_archives WHERE id = $1 AND user_id = $2", [id, user.rows[0].id]);
    }
    
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF
echo "  ✓ API /api/archive réécrite (quota par site, titre propre)"

# ==========================================================
# 2. PAGE /archive : affichage groupé par site
# ==========================================================
say "2/4 → Refonte de la page /archive (groupée par site)"

cat > "src/app/archive/page.tsx" << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ArchivePage() {
  const [sites, setSites] = useState<any[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [limit, setLimit] = useState(5);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadArchives = async () => {
    if (!pubkey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      if (res.ok) {
        setSites(d.archives || []);
        setIsPro(d.is_pro);
        setLimit(d.limit || 5);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchives(); }, [pubkey]);

  async function handleAdd() {
    if (!url || !pubkey) return;
    setAdding(true); setError('');
    try {
      const res = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, url })
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'Erreur');
      else { setUrl(''); loadArchives(); }
    } catch (e: any) {
      setError('Erreur réseau');
    }
    setAdding(false);
  }

  async function deleteSite(siteRoot: string, mainId: string) {
    if (!pubkey || !confirm('Supprimer ce site et toutes ses pages surveillées ?')) return;
    await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}&id=${mainId}`, { method: 'DELETE' });
    loadArchives();
  }

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-4xl mx-auto font-sans w-full min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-2" style={{color: 'var(--text-main)'}}>SCEAU Archive</h1>
          <p className="text-sm text-[var(--text-muted)]">Surveillez l'intégrité des sites web. Détectez les modifications en un clic.</p>
        </div>
        <a 
          href="/downloads/sceau-extension.zip" 
          download 
          className="bg-white border-2 border-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold text-xs hover:border-[#E76F51] transition shadow-sm hidden md:block"
        >
          Télécharger l'Extension Chrome
        </a>
      </div>

      {/* Quota */}
      {!isPro && (
        <div className="bg-[#FDF4F0] border border-[#FCE0D6] rounded-xl px-4 py-2 mb-6 inline-block">
          <p className="text-xs font-bold text-[#C44A2E]">
            Quota Gratuit : {sites.length} / {limit} sites
          </p>
        </div>
      )}

      {/* Formulaire */}
      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-8">
        <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 font-mono uppercase">
          Ajouter un site à surveiller
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input 
            type="url" 
            placeholder="https://www.exemple.com" 
            className="flex-1 min-w-0 border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2]"
            style={{color: 'var(--text-main)'}}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button 
            onClick={handleAdd} 
            disabled={adding || (!isPro && sites.length >= limit)}
            className="bg-[#1A1513] text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-black transition whitespace-nowrap"
          >
            {adding ? '...' : 'Sceller'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
        {!isPro && sites.length >= limit && (
          <p className="text-sm text-[#C44A2E] mt-3 font-bold">
            ⚠️ Limite de {limit} sites atteinte. <button onClick={() => alert("SCEAU PRO arrive bientôt !")} className="underline">Passez à PRO</button> pour en ajouter plus.
          </p>
        )}
      </div>

      {/* Liste groupée */}
      {loading ? (
        <p className="text-center font-mono py-10">Chargement...</p>
      ) : sites.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl">
          <div className="text-5xl mb-4">📡</div>
          <h3 className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>Aucun site surveillé</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto">
            Ajoutez l'URL d'un site pour que SCEAU le scanne chaque jour et vous alerte en cas de modification.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
          {sites.map((s, i) => (
            <div 
              key={s.site_root} 
              className={`flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-[var(--bg-main)] transition ${i !== sites.length - 1 ? 'border-b border-[var(--border-color)]' : ''} ${s.has_modifications ? 'bg-[#FDF4F0]' : ''}`}
            >
              <Link href={`/archive/${s.main_id}`} className="flex items-center gap-3 mb-3 md:mb-0 flex-1 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${s.has_modifications ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>
                    {s.main_title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {s.site_root}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[0.6rem] font-mono bg-[var(--bg-main)] border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                      {s.pages_count} page{s.pages_count > 1 ? 's' : ''}
                    </span>
                    {s.has_modifications && (
                      <span className="text-[0.6rem] font-bold bg-[#FDF4F0] text-[#C44A2E] border border-[#FCE0D6] px-1.5 py-0.5 rounded">
                        Modifié
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[0.65rem] font-mono text-[var(--text-muted)] mr-2 hidden sm:block">
                  {new Date(s.last_checked_at).toLocaleDateString('fr-FR')}
                </span>
                <Link
                  href={`/archive/${s.main_id}`}
                  className="bg-[#1A1513] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition"
                >
                  Voir →
                </Link>
                <button 
                  onClick={() => deleteSite(s.site_root, s.main_id)} 
                  className="text-red-400 hover:text-red-600 px-2 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
EOF
echo "  ✓ Page /archive groupée par site"

# ==========================================================
# 3. PAGE /archive/[id] : utilise site_root pour grouper
# ==========================================================
say "3/4 → Page /archive/[id] compatible groupement"

cat > "src/app/archive/[id]/page.tsx" << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ArchiveDetail() {
  const params = useParams();
  const router = useRouter();
  const [site, setSite] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadArchive = async () => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.replace('/login'); return; }

    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      const found = (d.archives || []).find((s: any) => s.main_id === params.id || s.pages.some((p: any) => p.id === params.id));
      if (found) {
        setSite(found);
        const page = found.pages.find((p: any) => p.id === params.id) || found.pages.find((p: any) => p.url === found.main_url) || found.pages[0];
        setCurrentPage(page);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchive(); }, [params.id]);

  async function runCheck() {
    if (!currentPage) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;

    setChecking(true);
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url: currentPage.id, action: 'check' })
    });
    await res.json();
    await loadArchive();
    setChecking(false);
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!site || !currentPage) return <div className="p-10 text-center">Archive introuvable.</div>;

  const daysSinceStart = Math.floor((Date.now() - new Date(site.created_at).getTime()) / 86400000);
  const isModified = currentPage.last_status === 'modified';
  const isError = currentPage.last_status === 'error';

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-3xl mx-auto font-sans w-full min-h-screen">
      <button onClick={() => router.push('/archive')} className="text-sm font-bold mb-4 flex items-center gap-2" style={{color: 'var(--text-muted)'}}>
        ← Retour à Archive
      </button>

      {/* Header site */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold font-serif mb-1 break-words" style={{color: 'var(--text-main)'}}>
              {site.main_title}
            </h1>
            <a href={site.site_root} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4A90C2] hover:underline break-all">
              {site.site_root}
            </a>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${site.has_modifications ? 'bg-[#FDF4F0] text-[#C44A2E]' : 'bg-green-50 text-green-700'}`}>
            {site.has_modifications ? '⚠️ Modifié' : '✅ Intact'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[var(--border-color)] pt-4">
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Suivi depuis</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{daysSinceStart} jour{daysSinceStart > 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Dernier scan</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{new Date(site.last_checked_at).toLocaleDateString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Pages suivies</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{site.pages_count}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Scans effectués</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{site.scan_count || 1}</p>
          </div>
        </div>
      </div>

      {/* Page courante */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Page actuelle</p>
            <p className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>
              {currentPage.title}
            </p>
            <a href={currentPage.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4A90C2] hover:underline break-all">
              {currentPage.url}
            </a>
          </div>
          <div className={`px-2 py-1 rounded text-[0.65rem] font-bold shrink-0 ${isModified ? 'bg-[#FDF4F0] text-[#C44A2E]' : isError ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
            {isModified ? 'Modifié' : isError ? 'Inaccessible' : 'Intact'}
          </div>
        </div>
      </div>

      {/* Statut / Diff */}
      {!isModified && !isError && (
        <div className="bg-[#F0FAF4] border border-[#A8C77E] rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-sm text-[#3F8F5C] mb-2">✅ Aucun changement détecté</h3>
          <p className="text-sm text-[#5D7A3A]">
            Le contenu de cette page est identique à la dernière vérification du {new Date(currentPage.last_checked_at).toLocaleString('fr-FR')}.
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

      {isModified && currentPage.diff_data && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm mb-6">
          <div className="p-4 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-sm" style={{color: 'var(--text-main)'}}>🔍 Changements détectés</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">{currentPage.diff_data.changesCount} ligne(s) modifiée(s)</p>
          </div>
          <div className="p-4 font-mono text-xs bg-[var(--bg-main)] max-h-96 overflow-y-auto">
            {currentPage.diff_data.details?.map((line: any, i: number) => (
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

      {/* Autres pages du site */}
      {site.pages.length > 1 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 mb-6">
          <h3 className="font-bold text-sm mb-3" style={{color: 'var(--text-main)'}}>📄 Autres pages suivies ({site.pages.length - 1})</h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {site.pages.filter((p: any) => p.id !== currentPage.id).map((p: any) => (
              <Link 
                key={p.id} 
                href={`/archive/${p.id}`}
                className="block p-2 rounded-lg hover:bg-[var(--bg-main)] transition text-xs"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="truncate" style={{color: 'var(--text-main)'}}>{p.title}</span>
                  <span className={`shrink-0 text-[0.6rem] px-1.5 py-0.5 rounded ${p.last_status === 'modified' ? 'bg-[#FDF4F0] text-[#C44A2E]' : 'bg-green-50 text-green-700'}`}>
                    {p.last_status === 'modified' ? '⚠️' : '✅'}
                  </span>
                </div>
              </Link>
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
          href={currentPage.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[180px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] py-3 rounded-xl font-bold text-sm text-center hover:border-[#E76F51] transition"
        >
          🌐 Visiter la page
        </a>
      </div>
    </div>
  );
}
EOF
echo "  ✓ Page /archive/[id] compatible groupement"

# ==========================================================
# 4. Fix global layout (padding bottom + overflow)
# ==========================================================
say "4/4 → Fix global layout (padding, overflow)"

python3 - << 'PYEOF'
import os

# Vérifie que toutes les pages ont bien le padding bottom mobile
pages_to_check = [
    'src/app/feed/page.tsx',
    'src/app/seal/page.tsx',
    'src/app/verify/page.tsx',
    'src/app/settings/page.tsx',
    'src/app/friends/page.tsx',
    'src/app/projets/page.tsx',
    'src/app/projets/[id]/page.tsx',
    'src/app/messages/page.tsx',
    'src/app/profil/page.tsx',
    'src/app/archive/page.tsx',
    'src/app/archive/[id]/page.tsx',
]

for path in pages_to_check:
    if not os.path.exists(path):
        continue
    s = open(path, encoding='utf-8').read()
    modified = False
    
    # Remplace les paddings mobiles incomplets
    replacements = [
        ('p-6 max-w-', 'p-6 pb-32 md:pb-6 max-w-'),
        ('p-4 max-w-', 'p-4 pb-32 md:pb-6 max-w-'),
    ]
    
    for old, new in replacements:
        if old in s and new not in s:
            # Évite de doubler si déjà patché
            s = s.replace(old, new, 1)
            modified = True
    
    if modified:
        open(path, 'w', encoding='utf-8').write(s)
        print(f'  ✓ {path}')
PYEOF

# ==========================================================
# 5. Build
# ==========================================================
say "Build final..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Archive groupée par site + quota 5 + fix global terminés !${NC}"
