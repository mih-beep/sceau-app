import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    // 1. Récupérer le projet sans JOIN complexe
    const projRes = await pool.query(`
      SELECT p.id, p.title, p.description, p.merkle_root, p.ots_proof, 
             p.parent_id, p.root_id, p.version_number, p.created_at, 
             u.handle as author
      FROM projects p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = $1
    `, [id]);

    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: 'Projet introuvable dans la base de données. Avez-vous exécuté le script SQL sur Neon ?' }, { status: 404 });
    }
    
    const project = projRes.rows[0];

    // 2. Récupérer le parent si parent_id existe
    let parent_title = null;
    if (project.parent_id) {
      try {
        const parentRes = await pool.query(`SELECT title FROM projects WHERE id = $1`, [project.parent_id]);
        if (parentRes.rows.length > 0) parent_title = parentRes.rows[0].title;
      } catch (e) {}
    }
    project.parent_title = parent_title;

    // 3. Récupérer les fichiers
    const filesRes = await pool.query(`
      SELECT pf.id, pf.file_name, pf.file_hash, pf.file_size, pf.file_path, pf.uploaded_by,
             u.handle as uploaded_by_handle
      FROM project_files pf
      LEFT JOIN users u ON pf.uploaded_by = u.id
      WHERE pf.project_id = $1 ORDER BY pf.file_name ASC
    `, [id]);

    // 4. Récupérer les membres (si la table existe)
    let membersRes: { rows: any[] } = { rows: [] };
    try {
      membersRes = await pool.query(`
        SELECT u.handle, u.id as user_id, pm.role, pm.added_at
        FROM project_members pm JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = $1 ORDER BY pm.added_at ASC
      `, [id]);
    } catch (e) { console.warn('Table project_members manquante', e); }

    // 5. Récupérer les versions
    const rootId = project.root_id || project.id;
    let versionsRes: { rows: any[] } = { rows: [] };
    try {
      versionsRes = await pool.query(`
        SELECT id, title, version_number, created_at, ots_proof
        FROM projects WHERE root_id = $1
        ORDER BY created_at ASC
      `, [rootId]);
    } catch (e) { console.warn('Erreur versions', e); }

    const latestId = versionsRes.rows[versionsRes.rows.length - 1]?.id;
    const isLatest = latestId === id;

    return NextResponse.json({
      ...project,
      files: filesRes.rows,
      members: membersRes.rows,
      versions: versionsRes.rows,
      is_latest: isLatest,
    });

  } catch (e: any) {
    console.error('[projects/[id] GET]', e);
    return NextResponse.json({ error: 'Erreur BDD', details: e.message }, { status: 500 });
  }
}
