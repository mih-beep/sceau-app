import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';

export const runtime = 'nodejs';
export const maxDuration = 30;

// === SÉCURITÉ SSRF ===
function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    
    const hostname = url.hostname.toLowerCase();
    // Blocage des localhost et IPs privées
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (/^10\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return false;
    if (/^169\.254\./.test(hostname)) return false;
    
    return true;
  } catch {
    return false;
  }
}

// === FONCTION DE NETTOYAGE UNIFIÉE ===
function cleanHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '') // Supprime JS
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '') // Supprime CSS
    .replace(/<[^>]*>/g, '\n') // Supprime les balises HTML
    .replace(/\n\s*\n/g, '\n') // Supprime les lignes vides
    .trim();
}

function hashContent(content: string): string {
  return Buffer.from(sha256(new TextEncoder().encode(content))).toString('hex');
}

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
      diff.push({ type: 'unchanged', text: oldLine.trim() });
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

    // === VÉRIFICATION (Le Scan Manuel) ===
    if (action === 'check') {
      const archive = await pool.query("SELECT id, url, last_hash, last_content FROM web_archives WHERE id = $1 AND user_id = $2", [url, userId]);
      if (archive.rows.length === 0) return NextResponse.json({ error: 'Archive introuvable' }, { status: 404 });
      
      const targetUrl = archive.rows[0].url;
      const oldHash = archive.rows[0].last_hash;
      const oldContent = archive.rows[0].last_content || '';

      try {
        const res = await fetch(targetUrl, { 
          headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' },
          signal: AbortSignal.timeout(10000) // 10 secondes max
        });
        
        if (!res.ok) throw new Error('Site inaccessible');
        
        const html = await res.text();
        if (html.length > 5 * 1024 * 1024) throw new Error('Contenu trop lourd'); // 5 Mo max
        
        const newText = cleanHtmlToText(html);
        const newHash = hashContent(newText);

        if (oldHash !== newHash) {
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
      } catch (e) {
        // En cas d'erreur (timeout, 404, SSRF), on marque l'archive en erreur
        await pool.query("UPDATE web_archives SET last_status = 'error', last_checked_at = NOW() WHERE id = $1", [url]);
        return NextResponse.json({ status: 'error', error: 'Impossible de vérifier le site.' });
      }
    }

    // === AJOUT D'UNE NOUVELLE URL ===
    if (!isSafeUrl(url)) {
      return NextResponse.json({ error: 'URL invalide ou non autorisée (sécurité).' }, { status: 400 });
    }

    try {
      const res = await fetch(url, { 
        headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!res.ok) throw new Error('Site inaccessible');
      
      const html = await res.text();
      if (html.length > 5 * 1024 * 1024) throw new Error('Contenu trop lourd');
      
      const cleanText = cleanHtmlToText(html);
      const newHash = hashContent(cleanText);
      const title = new URL(url).hostname;

      await pool.query(`
        INSERT INTO web_archives (user_id, url, title, last_hash, last_content, last_status) 
        VALUES ($1, $2, $3, $4, $5, 'intact')
      `, [userId, url, title, newHash, cleanText]);

      return NextResponse.json({ success: true });
    } catch (e: any) {
      return NextResponse.json({ error: 'Impossible de joindre le site web.' }, { status: 400 });
    }

  } catch (e: any) {
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
