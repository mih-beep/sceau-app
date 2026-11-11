import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Format d ID invalide' }, { status: 400 });
  }

  try {
    // 1. On récupère les infos de base
    const pactRes = await pool.query(`
      SELECT p.id, p.title, p.description, p.required_signatures, p.status, p.created_at, 
             u.handle as creator
      FROM pacts p JOIN users u ON p.creator_id = u.id 
      WHERE p.id = $1
    `, [id]);
    
    if (pactRes.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const pact = pactRes.rows[0];

    // 2. On récupère le hash et medias séparément pour éviter les crashs si les colonnes manquent
    let hash_str = null;
    let media_urls = [];
    try {
      const extra = await pool.query("SELECT encode(hash, 'base64') as hash_str, media_urls FROM pacts WHERE id = $1", [id]);
      if (extra.rows.length > 0) {
        hash_str = extra.rows[0].hash_str;
        media_urls = typeof extra.rows[0].media_urls === 'string' ? JSON.parse(extra.rows[0].media_urls) : (extra.rows[0].media_urls || []);
      }
    } catch (e) {
      console.warn('[pacts] Colonnes optionnelles manquantes (hash/media_urls)');
    }

    const signatures = await pool.query(
      "SELECT u.handle FROM pact_signatures s JOIN users u ON s.user_id = u.id WHERE s.pact_id = $1 ORDER BY s.created_at ASC", 
      [id]
    );
    
    return NextResponse.json({ 
      ...pact, 
      hash_str,
      media_urls,
      signataires: signatures.rows.map(r => r.handle) 
    });
  } catch (e: any) {
    console.error('[pacts GET]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
