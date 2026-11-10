#!/usr/bin/env bash
set -e

mkdir -p "src/app/api/projects/[id]/update"
mkdir -p "src/app/api/projects/[id]/members"
mkdir -p "src/app/api/projects/[id]/rollback"

# API GET + UPDATE
cat > "src/app/api/projects/[id]/route.ts" << 'ENDOFFILE'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const projRes = await pool.query(`
      SELECT p.*, u.handle as author, parent.title as parent_title
      FROM projects p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN projects parent ON p.parent_id = parent.id
      WHERE p.id = $1
    `, [id]);
    if (projRes.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const project = projRes.rows[0];
    const rootId = project.root_id || project.id;

    const filesRes = await pool.query(`
      SELECT pf.id, pf.file_name, pf.file_hash, pf.file_size, pf.file_path, pf.uploaded_by,
             u.handle as uploaded_by_handle
      FROM project_files pf
      LEFT JOIN users u ON pf.uploaded_by = u.id
      WHERE pf.project_id = $1 ORDER BY pf.file_name ASC
    `, [id]);

    const membersRes = await pool.query(`
      SELECT u.handle, u.id as user_id, pm.role, pm.added_at
      FROM project_members pm JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1 ORDER BY pm.added_at ASC
    `, [id]);

    const versionsRes = await pool.query(`
      SELECT id, title, version_number, created_at, ots_proof
      FROM projects WHERE root_id = $1
      ORDER BY created_at ASC
    `, [rootId]);

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
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
ENDOFFILE

echo "✅ GET /api/projects/[id] créé"
echo "📝 Lance maintenant : bash step2-members.sh"
