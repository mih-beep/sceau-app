import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { upgradeOts } from '@/lib/ots';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');

  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

  try {
    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const res = await pool.query(
      "SELECT author_id, hash, ots_proof FROM seals WHERE id = $1",
      [id]
    );
    if (res.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const row = res.rows[0];
    if (row.author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    if (!row.ots_proof) {
      return NextResponse.json({ status: 'no_proof', message: 'Aucune preuve .ots stockée.' });
    }

    const upgraded = await upgradeOts(new Uint8Array(row.hash), row.ots_proof);
    if (!upgraded) {
      return NextResponse.json({ status: 'pending', message: 'Pas encore confirmé. Réessaie dans quelques heures.' });
    }

    await pool.query(
      "UPDATE seals SET ots_proof = $1, ots_upgraded_at = NOW() WHERE id = $2",
      [upgraded.toString('base64'), id]
    );
    return NextResponse.json({ status: 'upgraded', size: upgraded.length });
  } catch (e) {
    return apiError(e, 'Erreur lors de la mise à jour de la preuve');
  }
}
