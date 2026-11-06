import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await pool.query("SELECT ots_proof, title FROM seals WHERE id = $1", [id]);
    if (res.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const row = res.rows[0];
    if (!row.ots_proof) return NextResponse.json({ error: 'Pas de preuve .ots' }, { status: 404 });

    const buffer = Buffer.from(row.ots_proof, 'base64');
    const safeTitle = (row.title || 'sceau').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeTitle}.ots"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
