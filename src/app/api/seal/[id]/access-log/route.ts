import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');

  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  const seal = await pool.query("SELECT author_id FROM seals WHERE id = $1", [id]);
  if (seal.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (seal.rows[0].author_id !== user.rows[0].id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'recent';

  let sql = `
    SELECT a.action, a.context, a.created_at, u.handle as viewer_handle,
      (SELECT COUNT(*) FROM seals WHERE author_id = u.id) as viewer_seals,
      u.created_at as viewer_account_created_at
    FROM access_log a JOIN users u ON a.viewer_id = u.id
    WHERE a.seal_id = $1
  `;
  const params: any[] = [id];

  if (search) {
    sql += ` AND u.handle ILIKE $2`;
    params.push(`%${search}%`);
  }

  if (sort === 'oldest_account') {
    sql += ` ORDER BY u.created_at ASC`;
  } else if (sort === 'newest_account') {
    sql += ` ORDER BY u.created_at DESC`;
  } else {
    sql += ` ORDER BY a.created_at DESC`;
  }

  sql += ` LIMIT 500`;
  const log = await pool.query(sql, params);

  return NextResponse.json({
    entries: log.rows.map((r: any) => ({
      action: r.action,
      context: r.context,
      at: r.created_at,
      viewer: r.viewer_handle,
      viewer_profile: {
        account_age_days: Math.floor((Date.now() - new Date(r.viewer_account_created_at).getTime()) / 86400000),
        seals_count: parseInt(r.viewer_seals || 0),
      },
    })),
  });
}
