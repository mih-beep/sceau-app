import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';
import { submitToOts } from '@/lib/ots';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { pact_id, pubkey } = await req.json();
  
  try {
    const user = await pool.query("SELECT id, handle FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const userId = user.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Vérifier si le pacte existe et n'est pas déjà scellé
      const pactRes = await client.query(
        "SELECT title, description, required_signatures, status FROM pacts WHERE id = $1 FOR UPDATE",
        [pact_id]
      );
      if (pactRes.rows.length === 0) throw new Error('Pacte introuvable');
      const pact = pactRes.rows[0];
      if (pact.status === 'scelle') throw new Error('Ce pacte est déjà scellé');

      // 2. Ajouter la signature (si pas déjà fait)
      await client.query(
        "INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [pact_id, userId]
      );

      // 3. Récupérer toutes les signatures actuelles
      const sigsRes = await client.query(
        `SELECT u.handle, s.created_at FROM pact_signatures s 
         JOIN users u ON s.user_id = u.id
         WHERE s.pact_id = $1 ORDER BY s.created_at ASC`,
        [pact_id]
      );
      const signatures = sigsRes.rows;

      let isNowSealed = false;

      // 4. Si on a atteint le quota, on scelle cryptographiquement
      if (signatures.length >= pact.required_signatures) {
        // Construction d'un JSON canonique (l'ordre est crucial)
        const canonical = JSON.stringify({
          title: pact.title,
          description: pact.description || '',
          signers: signatures.map((s: any) => ({
            handle: s.handle,
            signed_at: new Date(s.created_at).toISOString()
          }))
        });

        // Hash du contrat
        const pactHash = sha256(new TextEncoder().encode(canonical));
        const hashBase64 = Buffer.from(pactHash).toString('base64');

        // Ancrage Bitcoin
        let otsProof: string | null = null;
        try {
          const ots = await submitToOts(new Uint8Array(pactHash));
          if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
        } catch (e) { console.warn('[Pact OTS]', e); }

        // Mise à jour de la DB
        await client.query(
          `UPDATE pacts SET status = 'scelle', scelle_at = NOW(), hash = decode($1, 'base64'), ots_proof = $2 WHERE id = $3`,
          [hashBase64, otsProof, pact_id]
        );
        isNowSealed = true;
      }

      await client.query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        current: signatures.length, 
        required: pact.required_signatures,
        isNowSealed 
      });

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    return apiError(e, e.message || 'Erreur lors de la signature');
  }
}
