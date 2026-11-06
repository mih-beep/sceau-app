import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';
import { submitToOts } from '@/lib/ots';

export async function POST(req: Request) {
  const { pact_id, pubkey } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  try {
    await pool.query(
      "INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [pact_id, user.rows[0].id]
    );

    const pact = await pool.query(
      "SELECT title, description, required_signatures, status FROM pacts WHERE id = $1",
      [pact_id]
    );
    const sigs = await pool.query(
      `SELECT u.handle, s.created_at FROM pact_signatures s JOIN users u ON s.user_id = u.id
       WHERE s.pact_id = $1 ORDER BY s.created_at ASC`,
      [pact_id]
    );

    const required = pact.rows[0].required_signatures;
    const current = sigs.rows.length;

    if (current >= required && pact.rows[0].status !== 'scelle') {
      const canonical = JSON.stringify({
        title: pact.rows[0].title,
        description: pact.rows[0].description || '',
        signers: sigs.rows.map((r: any) => ({ handle: r.handle, signed_at: new Date(r.created_at).toISOString() })),
      });
      const pactHash = sha256(new TextEncoder().encode(canonical));

      let otsProof: string | null = null;
      try {
        const ots = await submitToOts(new Uint8Array(pactHash));
        if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
      } catch (e) { console.error('[Pact OTS]', e); }

      await pool.query(
        `UPDATE pacts SET status='scelle', scelle_at=NOW(), hash=$1, ots_proof=$2 WHERE id=$3`,
        [Buffer.from(pactHash), otsProof, pact_id]
      );
    }

    return NextResponse.json({ success: true, current, required });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
