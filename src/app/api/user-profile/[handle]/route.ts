import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { searchParams } = new URL(req.url);
  const viewerHandle = searchParams.get('viewer');

  try {
    const user = await pool.query("SELECT id, handle FROM users WHERE handle = $1", [handle]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const targetUserId = user.rows[0].id;

    let relationship = 'none';
    let viewerId = null;

    if (viewerHandle) {
      const viewer = await pool.query("SELECT id FROM users WHERE handle = $1", [viewerHandle]);
      if (viewer.rows.length > 0) {
        viewerId = viewer.rows[0].id;
        const friend = await pool.query(
          "SELECT status FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)",
          [viewerId, targetUserId]
        );
        if (friend.rows.length > 0) {
          if (friend.rows[0].status === 'accepted') relationship = 'friend';
          else relationship = 'pending';
        }
      }
    }

    let visFilter = "s.visibility = 'public'";
    if (viewerId === targetUserId) visFilter = "1=1"; 
    else if (relationship === 'friend') visFilter = "s.visibility IN ('public', 'friends')";

    const seals = await pool.query(`
      SELECT id, title, description, timestamp, is_hosted, file_path, visibility 
      FROM seals s WHERE author_id = $1 AND ${visFilter} ORDER BY created_at DESC
    `, [targetUserId]);

    return NextResponse.json({ handle: user.rows[0].handle, relationship, seals: seals.rows });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
