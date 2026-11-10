import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ projects: [] });

  try {
    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) return NextResponse.json({ projects: [] });

    const result = await pool.query(`
      SELECT p.id, p.title, p.description, p.merkle_root, p.ots_proof, p.created_at, p.parent_id,
             (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count
      FROM projects p 
      WHERE p.author_id = $1 
      ORDER BY p.created_at DESC
    `, [user.rows[0].id]);

    return NextResponse.json({ projects: result.rows });
  } catch (e: any) {
    console.error('[projects/list]', e);
    return NextResponse.json({ projects: [] });
  }
}
