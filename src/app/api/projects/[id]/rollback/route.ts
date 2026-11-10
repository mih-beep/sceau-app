import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { pubkey } = await req.json();
    if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const sourceRes = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
    if (sourceRes.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const source = sourceRes.rows[0];
    if (source.author_id !== user.rows[0].id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const latestRes = await pool.query("SELECT id, version_number FROM projects WHERE root_id = $1 ORDER BY created_at DESC LIMIT 1", [source.root_id || source.id]);
    const latest = latestRes.rows[0];
    const filesRes = await pool.query("SELECT * FROM project_files WHERE project_id = $1", [id]);

    const client = await pool.connect();
    let newId: string;
    try {
      await client.query('BEGIN');
      const newProjectRes = await client.query(
        `INSERT INTO projects (author_id, title, description, merkle_root, parent_id, root_id, version_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [source.author_id, source.title, source.description, source.merkle_root, latest.id, source.root_id || source.id, (latest.version_number || 0) + 1]
      );
      newId = newProjectRes.rows[0].id;
      for (const f of filesRes.rows) {
        await client.query(`INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId, f.file_name, f.file_hash, f.file_size, f.file_path, f.uploaded_by]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    return NextResponse.json({ success: true, project_id: newId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}
