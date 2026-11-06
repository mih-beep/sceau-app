import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { upgradeOts } from '@/lib/ots';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await pool.query("SELECT hash FROM seals WHERE id = $1", [id]);
    if (res.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const upgraded = await upgradeOts(new Uint8Array(res.rows[0].hash));
    if (!upgraded) {
      return NextResponse.json({ status: 'pending', message: 'Pas encore confirmé. Réessaie dans quelques heures.' });
    }
    await pool.query(
      "UPDATE seals SET ots_proof = $1, ots_upgraded_at = NOW() WHERE id = $2",
      [upgraded.toString('base64'), id]
    );
    return NextResponse.json({ status: 'upgraded', size: upgraded.length });
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
