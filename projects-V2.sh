#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. API GET /api/projects/[id] (enrichie)
# ==========================================================
say "1/5 → API GET /api/projects/[id]"

mkdir -p "src/app/api/projects/[id]"
cat > "src/app/api/projects/[id]/route.ts" << 'EOF'
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

    // Calcule la version la plus récente
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
EOF
echo "  ✓ API GET enrichie"

# ==========================================================
# 2. API POST /api/projects/[id]/update (ajout/suppression de fichiers)
# ==========================================================
say "2/5 → API POST /api/projects/[id]/update"

mkdir -p "src/app/api/projects/[id]/update"
cat > "src/app/api/projects/[id]/update/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { submitToOts } from '@/lib/ots';
import { buildMerkleRoot } from '@/lib/merkle';
import { safeKeyPart } from '@/lib/safe-key';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await req.formData();
    const pubkey = data.get('pubkey') as string;
    const title = ((data.get('title') as string) || '').trim();
    const description = ((data.get('description') as string) || '').trim();
    const filesToKeepStr = (data.get('files_to_keep') as string) || '[]';
    const newFiles = (data.getAll('new_files') as File[]).filter(f => f && f.size > 0);

    if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const userId = user.rows[0].id;

    // Charger l'ancien projet
    const oldRes = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
    if (oldRes.rows.length === 0) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    const oldProject = oldRes.rows[0];

    // Vérifier droits (owner ou membre)
    const isOwner = oldProject.author_id === userId;
    const isMember = (await pool.query(
      "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
      [id, userId]
    )).rows.length > 0;
    if (!isOwner && !isMember) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    const filesToKeep: string[] = JSON.parse(filesToKeepStr);

    // Charger les fichiers à conserver
    const keptFilesRes = await pool.query(
      `SELECT * FROM project_files WHERE project_id = $1 AND file_name = ANY($2)`,
      [id, filesToKeep]
    );

    // Préparer les nouveaux fichiers
    const newFileRecords: { name: string; hash: string; size: number; path: string | null }[] = [];
    const { endpoint, bucket } = requireS3();
    for (const file of newFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = Buffer.from(await crypto.subtle.digest('SHA-256', buffer)).toString('base64');
      const safeName = safeKeyPart(file.name, 60);
      const key = `projects/${userId.slice(0, 8)}/${Date.now()}-${safeName}`;
      await r2Client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      }));
      newFileRecords.push({ name: file.name, hash, size: buffer.length, path: `${endpoint}/${bucket}/${key}` });
    }

    // Manifest complet
    const allHashes = [
      ...keptFilesRes.rows.map(f => f.file_hash),
      ...newFileRecords.map(f => f.hash),
    ];
    const merkleRoot = buildMerkleRoot(allHashes);

    // Ancrage OTS
    let otsProof: string | null = null;
    try {
      const ots = await submitToOts(new Uint8Array(Buffer.from(merkleRoot, 'base64')));
      if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
    } catch (e) { console.warn('[OTS]', e); }

    // Nouvelle version
    const client = await pool.connect();
    let newId: string;
    try {
      await client.query('BEGIN');

      // Calcul du numéro de version
      const maxVRes = await client.query(
        "SELECT MAX(version_number) as m FROM projects WHERE root_id = $1",
        [oldProject.root_id || oldProject.id]
      );
      const newVersionNumber = (maxVRes.rows[0].m || 0) + 1;

      // Insert nouveau projet
      const newProjectRes = await client.query(`
        INSERT INTO projects (author_id, title, description, merkle_root, ots_proof, parent_id, root_id, version_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
      `, [
        oldProject.author_id,
        title || oldProject.title,
        description || oldProject.description,
        merkleRoot, otsProof, id,
        oldProject.root_id || oldProject.id,
        newVersionNumber,
      ]);
      newId = newProjectRes.rows[0].id;

      // Copier les fichiers gardés (on conserve leur uploaded_by d'origine)
      for (const f of keptFilesRes.rows) {
        await client.query(`
          INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [newId, f.file_name, f.file_hash, f.file_size, f.file_path, f.uploaded_by]);
      }

      // Ajouter les nouveaux fichiers (uploaded_by = user actuel)
      for (const f of newFileRecords) {
        await client.query(`
          INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [newId, f.name, f.hash, f.size, f.path, userId]);
      }

      // Copier les membres
      await client.query(`
        INSERT INTO project_members (project_id, user_id, role)
        SELECT $1, user_id, role FROM project_members WHERE project_id = $2
        ON CONFLICT DO NOTHING
      `, [newId, id]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, project_id: newId });
  } catch (e: any) {
    console.error('[projects/update POST]', e);
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}
EOF
echo "  ✓ API update créée"

# ==========================================================
# 3. API POST /api/projects/[id]/members
# ==========================================================
say "3/5 → API POST /api/projects/[id]/members"

mkdir -p "src/app/api/projects/[id]/members"
cat > "src/app/api/projects/[id]/members/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { pubkey, handle } = await req.json();
    if (!pubkey || !handle) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const project = await pool.query("SELECT author_id FROM projects WHERE id = $1", [id]);
    if (project.rows.length === 0) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    if (project.rows[0].author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Seul le créateur peut inviter' }, { status: 403 });
    }

    const target = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [handle.replace('@','')]);
    if (target.rows.length === 0) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    await pool.query(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING
    `, [id, target.rows[0].id]);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  const handle = searchParams.get('handle');
  if (!pubkey || !handle) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const project = await pool.query("SELECT author_id FROM projects WHERE id = $1", [id]);
    if (project.rows[0]?.author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const target = await pool.query("SELECT id FROM users WHERE LOWER(handle) = LOWER($1)", [handle.replace('@','')]);
    if (target.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    await pool.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [id, target.rows[0].id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF
echo "  ✓ API members créée"

# ==========================================================
# 4. API POST /api/projects/[id]/rollback
# ==========================================================
say "4/5 → API POST /api/projects/[id]/rollback"

mkdir -p "src/app/api/projects/[id]/rollback"
cat > "src/app/api/projects/[id]/rollback/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { submitToOts } from '@/lib/ots';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { pubkey } = await req.json();
    if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const sourceRes = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
    if (sourceRes.rows.length === 0) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    const source = sourceRes.rows[0];

    if (source.author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Seul le créateur peut rollback' }, { status: 403 });
    }

    // Trouver la version actuelle (la plus récente du root)
    const latestRes = await pool.query(
      "SELECT id, version_number FROM projects WHERE root_id = $1 ORDER BY created_at DESC LIMIT 1",
      [source.root_id || source.id]
    );
    const latest = latestRes.rows[0];

    // Charger les fichiers de la version source
    const filesRes = await pool.query("SELECT * FROM project_files WHERE project_id = $1", [id]);

    // Ancrage OTS (reprendre le merkle root de la source)
    let otsProof: string | null = null;
    try {
      if (source.merkle_root) {
        const ots = await submitToOts(new Uint8Array(Buffer.from(source.merkle_root, 'base64')));
        if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
      }
    } catch (e) { /* ignore */ }

    const client = await pool.connect();
    let newId: string;
    try {
      await client.query('BEGIN');
      const newProjectRes = await client.query(`
        INSERT INTO projects (author_id, title, description, merkle_root, ots_proof, parent_id, root_id, version_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
      `, [
        source.author_id, source.title, source.description,
        source.merkle_root, otsProof, latest.id,
        source.root_id || source.id,
        (latest.version_number || 0) + 1,
      ]);
      newId = newProjectRes.rows[0].id;

      for (const f of filesRes.rows) {
        await client.query(`
          INSERT INTO project_files (project_id, file_name, file_hash, file_size, file_path, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [newId, f.file_name, f.file_hash, f.file_size, f.file_path, f.uploaded_by]);
      }

      await client.query(`
        INSERT INTO project_members (project_id, user_id, role)
        SELECT $1, user_id, role FROM project_members WHERE project_id = $2
        ON CONFLICT DO NOTHING
      `, [newId, id]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, project_id: newId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}
EOF
echo "  ✓ API rollback créée"

# ==========================================================
# 5. Oracle dans sidebar desktop
# ==========================================================
say "5/5 → Oracle dans le sidebar desktop + refonte UI projets"

python3 - << 'PYEOF'
import sys
p = 'src/app/layout.tsx'
s = open(p, encoding='utf-8').read()

# Ajouter Oracle si absent
if "{ name: 'SCEAU Oracle', path: '/oracle' }" not in s:
    s = s.replace(
        "{ name: 'SCEAU Archive', path: '/archive' },",
        "{ name: 'SCEAU Archive', path: '/archive' },\n        { name: 'SCEAU Oracle', path: '/oracle' },"
    )
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Oracle ajouté au sidebar desktop')
else:
    print('  ✓ Oracle déjà dans le sidebar')
PYEOF

# Refonte UI /projets/[id]
cat > "src/app/projets/[id]/page.tsx" << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { generateProjectCertificate } from '@/lib/pdf';

export default function ProjetDetail() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteHandle, setInviteHandle] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [updating, setUpdating] = useState(false);

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;

  const loadProject = async () => {
    if (!params.id) return;
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      const d = await res.json();
      if (!d.error) setProject(d);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadProject(); }, [params.id]);

  const isOwner = project?.author_id && project.author_id === project?.author_id;
  // On va comparer avec le handle courant
  const amIOwner = project?.author === myHandle;
  const amIMember = project?.members?.some((m: any) => m.handle === myHandle);

  async function handleUpdate() {
    if (!project || !pubkey) return;
    setUpdating(true);
    try {
      const filesToKeep = project.files
        .filter((f: any) => !filesToDelete.includes(f.file_name))
        .map((f: any) => f.file_name);

      const formData = new FormData();
      formData.append('pubkey', pubkey);
      formData.append('files_to_keep', JSON.stringify(filesToKeep));
      newFiles.forEach(f => formData.append('new_files', f));

      const res = await fetch(`/api/projects/${project.id}/update`, {
        method: 'POST',
        body: formData,
      });
      const d = await res.json();
      if (res.ok) {
        router.push(`/projets/${d.project_id}`);
      } else {
        alert('Erreur : ' + d.error);
      }
    } catch (e) {
      alert('Erreur réseau');
    }
    setUpdating(false);
  }

  async function handleInvite() {
    if (!project || !pubkey || !inviteHandle) return;
    setInviteError('');
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, handle: inviteHandle }),
      });
      const d = await res.json();
      if (res.ok) {
        setInviteHandle('');
        setShowInviteModal(false);
        loadProject();
      } else {
        setInviteError(d.error || 'Erreur');
      }
    } catch (e) {
      setInviteError('Erreur réseau');
    }
  }

  async function handleRollback() {
    if (!project || !pubkey) return;
    if (!confirm('Créer une nouvelle version basée sur cette version ?')) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey }),
      });
      const d = await res.json();
      if (res.ok) {
        router.push(`/projets/${d.project_id}`);
      } else {
        alert('Erreur : ' + d.error);
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!project) return <div className="p-10 text-center">Projet introuvable.</div>;

  const isPending = !project.ots_proof;

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-4xl mx-auto font-sans w-full">
      <Link href="/projets" className="text-sm font-bold text-gray-500 hover:underline mb-4 inline-block">← Retour aux projets</Link>
      
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-6">
        {/* Header */}
        <div className="bg-[#1E1E1E] p-6 text-white flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold font-serif">{project.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Version {project.version_number || 1} · Dossier Miroir (Merkle)
              {project.parent_title && <span className="text-orange-400 font-bold ml-2">• de {project.parent_title}</span>}
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[0.65rem] font-mono uppercase text-gray-400">Hash Racine</p>
            <p className="text-xs font-mono bg-gray-800 px-2 py-1 rounded mt-1 break-all max-w-full md:max-w-[200px]">{project.merkle_root}</p>
          </div>
        </div>

        <div className="p-6">
          {/* Actions */}
          <div className="flex flex-wrap gap-2 mb-6">
            {project.is_latest && (amIOwner || amIMember) && (
              <button 
                onClick={() => setShowUpdateModal(true)}
                className="bg-[#4A90C2] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#2D6A9E] transition"
              >
                ✏️ Mettre à jour le dossier
              </button>
            )}
            {!project.is_latest && amIOwner && (
              <button 
                onClick={handleRollback}
                className="bg-[#E76F51] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#C75A22] transition"
              >
                🔄 Revenir à cette version
              </button>
            )}
            {amIOwner && (
              <button 
                onClick={() => setShowInviteModal(true)}
                className="bg-white border-2 border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:border-[#4A90C2] transition"
              >
                👥 Inviter un collaborateur
              </button>
            )}
            <button 
              onClick={() => generateProjectCertificate(project.title, project.author, project.merkle_root, project.files, project.created_at)}
              className="bg-white border-2 border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:border-[#E76F51] transition"
            >
              📄 Certificat PDF
            </button>
          </div>

          {/* Statut OTS */}
          {isPending ? (
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl text-sm text-center mb-6">
              <span className="font-bold text-orange-700">⏳ Ancrage en cours...</span>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-sm text-center mb-6">
              <span className="font-bold text-green-700">✅ Ancré sur Bitcoin · </span>
              <a href={`/api/projects/${project.id}/ots`} download className="text-green-600 font-bold underline">.ots</a>
            </div>
          )}

          {/* Membres */}
          {project.members && project.members.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-2" style={{color: 'var(--text-main)'}}>👥 Membres ({project.members.length})</h3>
              <div className="flex flex-wrap gap-2">
                {project.members.map((m: any) => (
                  <span key={m.handle} className="bg-[#F0F6FC] border border-[#C9D8E8] text-[#2D6A9E] px-3 py-1 rounded-lg text-xs font-bold">
                    @{m.handle}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fichiers */}
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg" style={{color: 'var(--text-main)'}}>📁 Fichiers ({project.files.length})</h3>
          </div>
          <div className="border rounded-xl overflow-hidden mb-6">
            {project.files.map((f: any) => (
              <div key={f.id} className="flex justify-between items-center p-3 border-b last:border-0 bg-gray-50 hover:bg-gray-100 transition">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-gray-800 truncate">{f.file_name}</p>
                  <p className="text-[0.65rem] font-mono text-gray-500 truncate">Hash : {f.file_hash.slice(0, 20)}...</p>
                  {f.uploaded_by_handle && (
                    <p className="text-[0.65rem] text-[#4A90C2] font-bold mt-1">Ajouté par @{f.uploaded_by_handle}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-gray-400 shrink-0 ml-3">{(f.file_size / 1024).toFixed(0)} Ko</span>
              </div>
            ))}
          </div>

          {/* Historique versions */}
          {project.versions && project.versions.length > 1 && (
            <div>
              <h3 className="font-bold text-sm mb-2" style={{color: 'var(--text-main)'}}>📜 Historique ({project.versions.length} versions)</h3>
              <div className="space-y-1">
                {project.versions.map((v: any, idx: number) => (
                  <Link 
                    key={v.id} 
                    href={`/projets/${v.id}`}
                    className={`block p-2 rounded-lg text-xs transition ${v.id === project.id ? 'bg-[#F0F6FC] border border-[#C9D8E2] font-bold' : 'hover:bg-gray-50'}`}
                  >
                    <span className="font-mono">V{idx + 1}</span> · {v.title} · {new Date(v.created_at).toLocaleString('fr-FR')}
                    {v.id === project.id && ' ← actuel'}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL : Mise à jour */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowUpdateModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Mettre à jour le dossier</h2>
            
            <h3 className="text-sm font-bold mb-2">Fichiers actuels (cochez pour supprimer)</h3>
            <div className="space-y-1 mb-4 max-h-60 overflow-y-auto border rounded-lg p-2">
              {project.files.map((f: any) => (
                <label key={f.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={filesToDelete.includes(f.file_name)}
                    onChange={e => {
                      if (e.target.checked) setFilesToDelete([...filesToDelete, f.file_name]);
                      else setFilesToDelete(filesToDelete.filter(n => n !== f.file_name));
                    }}
                    className="accent-red-500"
                  />
                  <span className="text-xs truncate">{f.file_name}</span>
                </label>
              ))}
            </div>

            <h3 className="text-sm font-bold mb-2">Ajouter de nouveaux fichiers</h3>
            <input 
              type="file" 
              multiple 
              onChange={e => setNewFiles(Array.from(e.target.files || []))}
              className="w-full text-sm mb-2"
            />
            {newFiles.length > 0 && (
              <p className="text-xs text-green-600 font-bold mb-4">+{newFiles.length} nouveau(x) fichier(s)</p>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowUpdateModal(false)} className="flex-1 py-2 rounded-lg bg-gray-100 font-bold">Annuler</button>
              <button 
                onClick={handleUpdate} 
                disabled={updating}
                className="flex-1 py-2 rounded-lg bg-[#4A90C2] text-white font-bold disabled:opacity-50"
              >
                {updating ? '...' : 'Créer la nouvelle version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : Inviter */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Inviter un collaborateur</h2>
            <input 
              type="text"
              placeholder="@pseudo"
              className="w-full border-2 border-gray-200 p-3 rounded-xl mb-2 outline-none focus:border-[#4A90C2]"
              value={inviteHandle}
              onChange={e => setInviteHandle(e.target.value)}
            />
            {inviteError && <p className="text-xs text-red-500 mb-2">{inviteError}</p>}
            <p className="text-xs text-gray-500 mb-4">Le collaborateur pourra ajouter des fichiers au projet.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2 rounded-lg bg-gray-100 font-bold">Annuler</button>
              <button onClick={handleInvite} className="flex-1 py-2 rounded-lg bg-[#4A90C2] text-white font-bold">Inviter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
EOF
echo "  ✓ Page /projets/[id] refondue"

say "Build final..."
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Projets V2 : ajout/suppression fichiers, membres, rollback, attribution et Oracle sidebar !${NC}"
