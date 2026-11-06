import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { hash, query } = await req.json();
    
    // 1. Recherche par Hash (Vérification classique)
    if (hash) {
      const result = await pool.query(`
        SELECT s.title, s.timestamp, s.is_hosted, s.file_path, s.category, u.handle as author
        FROM seals s JOIN users u ON s.author_id = u.id
        WHERE encode(s.hash, 'base64') = $1
        ORDER BY s.timestamp ASC
      `, [hash]);
      if (result.rows.length > 0) return NextResponse.json({ found: true, seals: result.rows });
      return NextResponse.json({ found: false });
    }

    // 2. Recherche par Titre (Découverte publique)
    if (query) {
      const result = await pool.query(`
        SELECT s.title, s.timestamp, s.is_hosted, s.file_path, s.category, encode(s.hash, 'base64') as hash, u.handle as author
        FROM seals s JOIN users u ON s.author_id = u.id
        WHERE s.title ILIKE $1 AND s.is_public = TRUE
        ORDER BY s.timestamp DESC LIMIT 20
      `, [`%${query}%`]);
      
      return NextResponse.json({ found: result.rows.length > 0, seals: result.rows });
    }

    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
