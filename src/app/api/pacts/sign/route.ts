import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { pact_id, pubkey, receiver_handle } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

  try {
    // 1. Enregistrer la signature
    await pool.query(
      "INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", 
      [pact_id, user.rows[0].id]
    );

    // 2. Vérifier si le pacte est complet (le créateur + le destinataire ont signé)
    const signatures = await pool.query(`
      SELECT u.handle FROM pact_signatures s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.pact_id = $1
    `, [pact_id]);

    const signataires = signatures.rows.map(r => r.handle);
    const creator = await pool.query("SELECT u.handle as creator FROM pacts p JOIN users u ON p.creator_id = u.id WHERE p.id = $1", [pact_id]);
    const creatorHandle = creator.rows[0].creator;

    // Si le créateur et le destinataire ont signé, on scelle le pacte !
    if (signataires.includes(creatorHandle) && signataires.includes(receiver_handle)) {
      const now = new Date().toISOString();
      await pool.query("UPDATE pacts SET status = 'scelle', created_at = $1 WHERE id = $2", [now, pact_id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
