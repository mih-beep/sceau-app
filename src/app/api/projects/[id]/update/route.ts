import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { buildMerkleRoot } from '@/lib/merkle';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await req.formData();
    const pubkey = data.get('pubkey') as string;
    const filesToKeepStr = (data.get('files_to_keep') as string) || '[]';
    if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const userId = user.rows[0].id;

    const oldRes = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
    if (oldRes.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const oldProject = oldRes.rows[0];

    const isOwner = oldProject.author_id === userId;
    const isMember = (await pool.query("SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2", [id, userId])).rows.length > 0;
    if (!isOwner && !isMember) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const filesToKeep = JSON.parse(filesToKeepStr) as string[];
    const keptFilesRes = await pool.query("SELECT * FROM project_files WHERE project_id = $1 AND file_name = ANY($2)", [id, filesToKeep]);

    // Nouveaux fichiers (juste leurs hashs, pas d'upload pour l'instant)
    const newFiles = (data.getAll('new_files') as File[]).filter(f => f && f.size > 0);
    const newFileRecords: { name: string; hash: string; size: number; path: string | null }[] = [];
    for (const file of newFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = Buffer.from(await crypto.subtle.digest('SHA-256', buffer)).toString('base64');
      newFileRecords.push({ name: file.name, hash, size: buffer.length, path: null });
    }

    const allHashes = [...keptFilesRes.rows.map(f => f.file_hash), ...newFileRecords.map(f => f.hash)];
    const merkleRoot = buildMerkleRoot(allHashes);

    const client = await pool.connect();
    let newId: string;
    try {
      await client.query('BEGIN');
      const maxVRes = await client.query("SELECT MAX(version_number) as m FROM projects WHERE root_id = $1", [oldProject.root_id || oldProject.id]);
      const newVersion = (maxVRes.rows[0].m || 0) + 1;
      
      const newProjectRes = await client.query(
        `INSERT INTO projects (author_id, title, description, merkle_root, parent_id, root_id, version_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [oldProject.author_id, oldProject.title, oldProject.description, merkleRoot, id, oldProject.root_id || oldProject.id, newVersion]
      );
      newId = newProjectRes.rows[0].id;

      for (const f of keptFilesRes.rows) {
        await client.query(`INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId, f.file_name, f.file_hash, f.file_size, f.file_path, f.uploaded_by]);
      }
      for (const f of newFileRecords) {
        await client.query(`INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId, f.name, f.hash, f.size, f.path, userId]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    return NextResponse.json({ success: true, project_id: newId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}
