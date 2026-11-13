import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';
import { summarizeChange } from '@/lib/oracle-summary';
import { cleanHtmlToText as cleanHtmlToTextNew, isSignificantChange } from '@/lib/html-cleaner';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_PAGES = 200; // Limite par batch (le cron fera le reste)
const FREE_LIMIT = 5;  // Sites gratuits (pas pagesToScan)
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
  return cleanHtmlToTextNew(html);
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
    return matches.map(m => m.replace(/<\/?loc>/g, '').trim());
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

    const pagesToScan = await pool.query(`
      SELECT id, url, site_root, title, last_status, last_checked_at, created_at,
             diff_data, pages_scanned, scan_count, ai_summary
      FROM web_archives WHERE user_id = $1 ORDER BY created_at ASC
    `, [userId]);

    // Regroupement par site_root
    const sitesMap = new Map<string, any>();
    for (const page of pagesToScan.rows) {
      const siteRoot = page.site_root || (() => {
        try { return new URL(page.url).origin; } catch { return page.url; }
      })();

      if (!sitesMap.has(siteRoot)) {
        sitesMap.set(siteRoot, {
          site_root: siteRoot,
          root_id: page.id,
          main_url: page.url,
          main_title: page.title || siteRoot,
          children_count: 0,
          children_modified: 0,
          last_checked_at: page.last_checked_at,
          created_at: page.created_at,
          scan_count: page.scan_count || 1,
          pagesToScan: [],
          recent_changes: [],
        });
      }

      const site = sitesMap.get(siteRoot);
      site.pagesToScan.push(page);
      if (page.site_root === null || page.url === siteRoot || page.url === `${siteRoot}/`) {
        site.root_id = page.id;
        site.main_title = page.title || site.main_title;
      }
      if (page.last_status === 'modified') {
        site.children_modified++;
        if (page.ai_summary) {
          site.recent_changes.push({
            page_id: page.id,
            page_title: page.title,
            page_url: page.url,
            ai_summary: page.ai_summary,
            changed_at: page.last_checked_at,
          });
        }
      }
      if (new Date(page.last_checked_at) > new Date(site.last_checked_at)) {
        site.last_checked_at = page.last_checked_at;
      }
    }

    // Trier les changements récents par date desc
    const sitesArray = Array.from(sitesMap.values()).map((site) => {
      site.recent_changes.sort((a: any, b: any) =>
        new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
      );
      site.recent_changes = site.recent_changes.slice(0, 5);
      site.children_count = site.pagesToScan.length - 1;
      delete site.pagesToScan;
      return site;
    });

    return NextResponse.json({
      sites: sitesArray,
      is_pro: isPro,
      limit: isPro ? 50 : 5,
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
        
        // 🧠 Résumé IA du changement
        const aiSummary = await summarizeChange(oldContent, scan.text, targetUrl);
        
        await pool.query(
          `UPDATE web_archives 
           SET last_status = 'modified', last_checked_at = NOW(), diff_data = $1, 
               last_hash = $2, last_content = $3, scan_count = COALESCE(scan_count, 0) + 1,
               ai_summary = $5
           WHERE id = $4`,
          [JSON.stringify(diffResult), scan.hash, scan.text, url, aiSummary]
        );
        return NextResponse.json({ status: 'modified', changes: diffResult.changesCount, summary: aiSummary });
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

    // Si le site existe déjà, on ajoute juste les nouvelles pagesToScan
    // Sinon, on crawle comme d'habitude

    // === CRAWL EXHAUSTIF (BFS) AVEC LIMITE DE TEMPS ===
    const startTime = Date.now();
    const TIME_LIMIT_MS = 25000; // 25 secondes pour éviter le timeout Vercel
    const MAX_PAGES_PER_BATCH = 50;

    // Récupération des URLs de départ (Sitemap ou page d'accueil)
    let urlsToVisit: string[] = [];
    const sitemapPages = await fetchSitemap(siteRoot);
    if (sitemapPages.length > 0) {
      urlsToVisit = sitemapPages;
    } else {
      const rootHtml = await fetch(url, {
        headers: { 'User-Agent': 'SCEAU-Bot/1.0' },
        signal: AbortSignal.timeout(8000),
      }).then(r => r.ok ? r.text() : null).catch(() => null);
      if (!rootHtml) return NextResponse.json({ error: 'Impossible de joindre le site.' }, { status: 400 });
      urlsToVisit = [url, ...extractInternalLinks(rootHtml, url)];
    }

    const visited = new Set<string>();
    const pagesToScan: string[] = [];
    const queue = [...urlsToVisit];

    while (queue.length > 0 && (Date.now() - startTime) < TIME_LIMIT_MS && pagesToScan.length < MAX_PAGES_PER_BATCH) {
      const currentUrl = queue.shift()!;
      const normalizedUrl = currentUrl.split('#')[0];
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);
      pagesToScan.push(normalizedUrl);

      try {
        const res = await fetch(normalizedUrl, {
          headers: { 'User-Agent': 'SCEAU-Bot/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const html = await res.text();
          const newLinks = extractInternalLinks(html, normalizedUrl);
          queue.push(...newLinks);
        }
      } catch { /* ignore les pagesToScan mortes */ }
    }

    const scanResults = await Promise.all(pagesToScan.map(p => scanPage(p)));
    
    let insertedCount = 0;
    for (let i = 0; i < pagesToScan.length; i++) {
      const pageUrl = pagesToScan[i];
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
        `, [userId, pageUrl, siteRoot, pageData.title, pageData.hash, pageData.text, pagesToScan.length]);
        insertedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      pages_scanned: insertedCount,
      total_pages: pagesToScan.length,
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

    // Si c'est un site entier, on supprime toutes ses pagesToScan
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
