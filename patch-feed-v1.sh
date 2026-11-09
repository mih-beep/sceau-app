#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Capsule Temporelle : UI (seal/page.tsx) + API (seal/route.ts)
# ==========================================================
say "1/4 → Capsule Temporelle (UI + Backend)"

python3 - << 'PYEOF'
p = 'src/app/seal/page.tsx'
s = open(p, encoding='utf-8').read()

# Ajouter le state revealAt s'il n'y est plus
if 'const [revealAt, setRevealAt]' not in s:
    s = s.replace(
        "const [unlockLikes, setUnlockLikes] = useState(10);",
        "const [unlockLikes, setUnlockLikes] = useState(10);\n  const [revealAt, setRevealAt] = useState('');"
    )

# Ajouter l'input date dans les options
old_opts = """            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isEphemeral} onChange={e => setIsEphemeral(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>⏳ Éphémère (24h)</span>
            </label>"""
new_opts = """            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isEphemeral} onChange={e => setIsEphemeral(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>⏳ Éphémère (24h)</span>
            </label>

            <div className="pt-2 border-t border-[var(--border-color)]">
              <label className="text-xs font-mono font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>⏱️ Capsule Temporelle (optionnel)</label>
              <input type="date" value={revealAt} onChange={e => setRevealAt(e.target.value)} className="w-full border-2 border-[var(--border-color)] p-2 rounded-lg bg-transparent text-sm" style={{ color: 'var(--text-main)' }} />
            </div>"""
if old_opts in s: s = s.replace(old_opts, new_opts)

# Ajouter au FormData
s = s.replace(
    "formData.append('unlockLikes', unlockLikes.toString());",
    "formData.append('unlockLikes', unlockLikes.toString());\n      formData.append('reveal_at', revealAt);"
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ seal/page.tsx : Capsule restaurée')
PYEOF

# API Seal pour enregistrer la capsule
python3 - << 'PYEOF'
p = 'src/app/api/seal/route.ts'
s = open(p, encoding='utf-8').read()

s = s.replace(
    "const isHostedInput = data.get('isHosted') !== 'false'; // par défaut : true",
    "const isHostedInput = data.get('isHosted') !== 'false';\n    const revealAt = (data.get('reveal_at') as string) || null;"
)

s = s.replace(
    "ots_proof, ots_submitted_at, project_id, version_number, challenge_id",
    "ots_proof, ots_submitted_at, project_id, version_number, challenge_id, reveal_at"
)

s = s.replace(
    "decode($1, 'base64'), NOW(), $2, $3, $4, $5, $6,\n          $7, $8, $9, $10, $11, $12, $13,\n          $14, $15, $16, $17, $18",
    "decode($1, 'base64'), NOW(), $2, $3, $4, $5, $6,\n          $7, $8, $9, $10, $11, $12, $13,\n          $14, $15, $16, $17, $18, $19"
)

s = s.replace(
    "otsProof, otsProof ? new Date() : null,\n          projectId, versionNumber, challengeId,",
    "otsProof, otsProof ? new Date() : null,\n          projectId, versionNumber, challengeId, revealAt || null,"
)
open(p, 'w', encoding='utf-8').write(s)
print('  ✓ api/seal/route.ts : Capsule enregistrée')
PYEOF


# ==========================================================
# 2. API Attachments (Créations rattachées) - Refonte
# ==========================================================
say "2/4 → API Attachments (support vidéo/photo/texte + commentaires)"

mkdir -p "src/app/api/creations"
cat > "src/app/api/creations/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { safeKeyPart } from '@/lib/safe-key';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';

// GET : Récupérer les créations d'un sceau (ou d'une création si parent_id est fourni)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sealId = searchParams.get('seal_id');
  const parentId = searchParams.get('parent_id');

  if (!sealId) return NextResponse.json({ error: 'seal_id manquant' }, { status: 400 });

  try {
    let sql = `
      SELECT a.id, a.type, a.content, a.media_url, a.created_at, a.parent_id, u.handle as author
      FROM attachments a 
      JOIN users u ON a.user_id = u.id
      WHERE a.seal_id = $1
    `;
    const params: any[] = [sealId];

    if (parentId) {
      sql += " AND a.parent_id = $2";
      params.push(parentId);
    } else {
      sql += " AND a.parent_id IS NULL"; // On ne récupère que le niveau principal
    }

    sql += " ORDER BY a.created_at DESC LIMIT 50";
    
    const result = await pool.query(sql, params);
    return NextResponse.json({ creations: result.rows });
  } catch (e) {
    console.error('[creations GET]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// POST : Créer une nouvelle création (vidéo, image, ou texte)
export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const seal_id = data.get('seal_id') as string;
    const pubkey = data.get('pubkey') as string;
    const content = data.get('content') as string || '';
    const type = data.get('type') as string || 'text';
    const parent_id = data.get('parent_id') as string || null;
    const file = data.get('file') as File | null;

    if (!seal_id || !pubkey) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    let media_url: string | null = null;

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { endpoint, bucket } = requireS3();
      const key = `creations/${safeKeyPart(seal_id.slice(0, 8))}/${Date.now()}-${safeKeyPart(file.name)}`;
      
      await r2Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      }));
      media_url = `${endpoint}/${bucket}/${key}`;
    }

    const res = await pool.query(
      `INSERT INTO attachments (seal_id, user_id, content, type, media_url, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [seal_id, user.rows[0].id, content, type, media_url, parent_id]
    );

    return NextResponse.json({ success: true, id: res.rows[0].id });
  } catch (e) {
    console.error('[creations POST]', e);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}
EOF

echo -e "${GREEN}✅ API Créations prête (vidéos, images, commentaires imbriqués).${NC}"
