import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await pool.query("SELECT ots_proof, title FROM projects WHERE id = $1", [id]);
    if (res.rows.length === 0 || !res.rows[0].ots_proof) {
      return NextResponse.json({ error: 'Preuve non disponible (Pending)' }, { status: 404 });
    }

    const buffer = Buffer.from(res.rows[0].ots_proof, 'base64');
    const safeTitle = (res.rows[0].title || 'projet').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40);
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeTitle}.ots"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
