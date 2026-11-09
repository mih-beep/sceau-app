import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const projectRes = await pool.query(`
      SELECT p.*, u.handle as author, parent.title as parent_title, parent.id as parent_id
      FROM projects p 
      JOIN users u ON p.author_id = u.id 
      LEFT JOIN projects parent ON p.parent_id = parent.id
      WHERE p.id = $1
    `, [id]);

    if (projectRes.rows.length === 0) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    
    const filesRes = await pool.query(`
      SELECT id, file_name, file_hash, file_size, file_path 
      FROM project_files WHERE project_id = $1 ORDER BY file_name ASC
    `, [id]);

    return NextResponse.json({ 
      ...projectRes.rows[0], 
      files: filesRes.rows 
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
