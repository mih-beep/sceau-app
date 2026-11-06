import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sealId = searchParams.get('seal_id');
  if (!sealId) return NextResponse.json({ error: 'Manquant' }, { status: 400 });

  try {
    const result = await pool.query(`
      SELECT a.id, a.type, a.content, a.media_url, a.created_at, u.handle as author
      FROM attachments a JOIN users u ON a.user_id = u.id
      WHERE a.seal_id = $1 ORDER BY a.created_at ASC
    `, [sealId]);
    return NextResponse.json({ attachments: result.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const { seal_id, pubkey, content, type, media_url } = await req.json();
  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    await pool.query(
      "INSERT INTO attachments (seal_id, user_id, content, type, media_url) VALUES ($1, $2, $3, $4, $5)",
      [seal_id, user.rows[0].id, content, type || 'text', media_url || null]
    );
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
