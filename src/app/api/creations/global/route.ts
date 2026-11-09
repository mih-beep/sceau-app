import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // On récupère toutes les créations principales (pas les commentaires)
    // On fait un ORDER BY RANDOM() pour le côté "découverte" et aléatoire demandé
    const result = await pool.query(`
      SELECT a.id, a.type, a.content, a.media_url, a.created_at, 
             u.handle as author,
             s.id as seal_id, s.title as seal_title
      FROM attachments a 
      JOIN users u ON a.user_id = u.id
      JOIN seals s ON a.seal_id = s.id
      WHERE a.parent_id IS NULL 
      ORDER BY RANDOM() 
      LIMIT 50
    `);
    return NextResponse.json({ creations: result.rows });
  } catch (e) {
    console.error('[creations/global]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
