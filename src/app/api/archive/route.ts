import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';

export const runtime = 'nodejs';
export const maxDuration = 30; // Nécessaire pour le temps de fetch

// Fonction utilitaire pour hasher le contenu
function hashContent(content: string): string {
  const hash = sha256(new TextEncoder().encode(content));
  return Buffer.from(hash).toString('hex');
}

// GET : Lister les archives de l'utilisateur
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

  try {
    const user = await pool.query("SELECT id, is_pro FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    
    const result = await pool.query(`
      SELECT id, url, title, status, last_checked_at, created_at 
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

// POST : Ajouter une URL
export async function POST(req: Request) {
  const { pubkey, url, action } = await req.json();
  if (!pubkey || !url) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id, is_pro FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    
    const userId = user.rows[0].id;
    const isPro = user.rows[0].is_pro;

    // 1. Vérification du quota
    const countQuery = await pool.query("SELECT COUNT(*) as count FROM web_archives WHERE user_id = $1", [userId]);
    const currentCount = parseInt(countQuery.rows[0].count);
    const maxLimit = isPro ? 50 : 3;

    if (currentCount >= maxLimit && action !== 'check') {
      return NextResponse.json({ error: `Quota atteint (${maxLimit} URLs max). Passez à SCEAU PRO pour en ajouter plus.` }, { status: 403 });
    }

    // 2. Si c'est une vérification (action === 'check')
    if (action === 'check') {
      const archive = await pool.query("SELECT id, url, last_hash FROM web_archives WHERE id = $1 AND user_id = $2", [url, userId]); // Ici 'url' contient l'ID
      if (archive.rows.length === 0) return NextResponse.json({ error: 'Archive introuvable' }, { status: 404 });
      
      const targetUrl = archive.rows[0].url;
      const oldHash = archive.rows[0].last_hash;

      const res = await fetch(targetUrl, { headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' } });
      const html = await res.text();
      const newHash = hashContent(html);

      const isModified = oldHash !== newHash;
      
      if (isModified) {
        await pool.query("UPDATE web_archives SET status = 'modified', last_checked_at = NOW() WHERE id = $1", [url]); // 'url' = id
        return NextResponse.json({ status: 'modified' });
      } else {
        await pool.query("UPDATE web_archives SET status = 'intact', last_checked_at = NOW() WHERE id = $1", [url]);
        return NextResponse.json({ status: 'intact' });
      }
    }

    // 3. Sinon, c'est une nouvelle URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: 'URL invalide (doit commencer par http)' }, { status: 400 });
    }

    // Fetch initial
    const res = await fetch(url, { headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' } });
    if (!res.ok) return NextResponse.json({ error: 'Impossible de joindre le site web.' }, { status: 400 });
    
    const html = await res.text();
    const newHash = hashContent(html);
    const title = new URL(url).hostname;

    const insert = await pool.query(`
      INSERT INTO web_archives (user_id, url, title, last_hash, status) 
      VALUES ($1, $2, $3, $4, 'intact') RETURNING id
    `, [userId, url, title, newHash]);

    return NextResponse.json({ success: true, id: insert.rows[0].id });

  } catch (e: any) {
    return NextResponse.json({ error: 'Erreur lors du traitement : ' + e.message }, { status: 500 });
  }
}

// DELETE : Supprimer une URL
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
