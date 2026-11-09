import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { submitToOts } from '@/lib/ots';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const { apiKey, title, content, category } = await req.json();

    if (!apiKey || !title || !content) {
      return NextResponse.json({ error: 'Champs manquants (apiKey, title, content)' }, { status: 400, headers: CORS });
    }

    // 1. Vérifier la clé API
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyQuery = await pool.query(
      "SELECT user_id FROM api_keys WHERE key_hash = $1",
      [keyHash]
    );

    if (keyQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Clé API invalide' }, { status: 401, headers: CORS });
    }

    const userId = keyQuery.rows[0].user_id;

    // Mettre à jour la date de dernière utilisation
    await pool.query("UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1", [keyHash]);

    // 2. Calculer le hash du contenu (texte)
    const textBuffer = Buffer.from(content, 'utf-8');
    const hashBytes = sha256(new Uint8Array(textBuffer));
    const hashB64 = Buffer.from(hashBytes).toString('base64');

    // 3. Ancrage OpenTimestamps (best effort)
    let otsProof: string | null = null;
    try {
      const ots = await submitToOts(new Uint8Array(hashBytes));
      if (ots.ok && ots.proof) {
        otsProof = ots.proof.toString('base64');
      }
    } catch (e) { console.warn('[Plugin OTS]', e); }

    // 4. Enregistrer le sceau
    const result = await pool.query(
      `INSERT INTO seals (
        hash, timestamp, author_id, title, description, is_public, visibility,
        is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral,
        ots_proof, ots_submitted_at, category
      ) VALUES (
        decode($1, 'base64'), NOW(), $2, $3, '', true, 'public',
        false, null, 0, false, false, 0, false,
        $4, $5, $6
      ) RETURNING id`,
      [hashB64, userId, title, otsProof, otsProof ? new Date() : null, category || 'Art']
    );

    return NextResponse.json({
      success: true,
      seal_id: result.rows[0].id,
      hash: hashB64,
      ots_secured: otsProof !== null
    }, { headers: CORS });

  } catch (e) {
    console.error('[plugin/seal]', e);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500, headers: CORS });
  }
}
