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
