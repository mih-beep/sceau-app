import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { hash, query } = await req.json();
    
    // 1. Recherche par Hash (Vérification classique + Projets)
    if (hash) {
      // a) On cherche dans les sceaux individuels
      const sealResult = await pool.query(`
        SELECT s.title, s.timestamp, s.is_hosted, s.file_path, s.category, u.handle as author,
               'seal' as type
        FROM seals s JOIN users u ON s.author_id = u.id
        WHERE encode(s.hash, 'base64') = $1
      `, [hash]);

      // b) On cherche dans les fichiers de projets (Arbre de Merkle)
      const projectResult = await pool.query(`
        SELECT pf.file_name as title, p.created_at as timestamp, 
               CASE WHEN pf.file_path IS NOT NULL THEN true ELSE false END as is_hosted, 
               pf.file_path, 'Projet' as category, u.handle as author,
               'project' as type, p.title as project_title, p.id as project_id
        FROM project_files pf 
        JOIN projects p ON pf.project_id = p.id
        JOIN users u ON p.author_id = u.id
        WHERE pf.file_hash = $1
      `, [hash]);

      const combinedSeals = [...sealResult.rows, ...projectResult.rows];

      if (combinedSeals.length > 0) {
        return NextResponse.json({ found: true, seals: combinedSeals });
      }
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
