import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const current = await pool.query(
      "SELECT id, project_id, version_number FROM seals WHERE id = $1",
      [id]
    );
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    const projectId = current.rows[0].project_id;
    if (!projectId) {
      return NextResponse.json({
        root_id: id,
        current_version: current.rows[0].version_number || 1,
        versions: [],
      });
    }

    const versions = await pool.query(
      `SELECT s.id, s.title, s.version_number, s.timestamp,
              encode(s.hash, 'base64') as hash,
              (s.ots_proof IS NOT NULL) as has_ots
       FROM seals s
       WHERE s.project_id = $1
       ORDER BY s.version_number ASC`,
      [projectId]
    );

    return NextResponse.json({
      root_id: projectId,
      current_version: current.rows[0].version_number || 1,
      versions: versions.rows,
    });
  } catch (e) {
    console.error('[versions]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
