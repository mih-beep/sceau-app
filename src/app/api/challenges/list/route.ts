import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT c.id, c.title, c.deadline, c.is_anonymous, u.handle as creator,
      (SELECT COUNT(*) FROM challenge_entries WHERE challenge_id = c.id) as entries_count
      FROM challenges c JOIN users u ON c.creator_id = u.id
      ORDER BY c.created_at DESC
    `);
    return NextResponse.json({ challenges: result.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
