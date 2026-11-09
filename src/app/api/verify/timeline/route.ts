import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const isLive = searchParams.get('live') === 'true';

  try {
    let sql = `
      SELECT s.id, s.title, s.category, s.timestamp, u.handle as author
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.is_public = TRUE
    `;
    const params: any[] = [];

    if (isLive) {
      // Mode direct : on prend les 20 derniers
      sql += ` ORDER BY s.timestamp DESC LIMIT 20`;
    } else {
      // Mode période : filtré par dates
      if (start) {
        sql += ` AND s.timestamp >= $${params.length + 1}`;
        params.push(new Date(start));
      }
      if (end) {
        sql += ` AND s.timestamp <= $${params.length + 1}`;
        params.push(new Date(end));
      }
      sql += ` ORDER BY s.timestamp DESC LIMIT 50`;
    }

    const result = await pool.query(sql, params);
    return NextResponse.json({ timeline: result.rows });
  } catch (e) {
    console.error('[timeline]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
