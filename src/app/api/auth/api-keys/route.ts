import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import crypto from 'crypto';

// GET : Lister les clés de l'utilisateur (masquées)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    const result = await pool.query(
      "SELECT id, name, created_at, last_used_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
      [user.rows[0].id]
    );
    return NextResponse.json({ keys: result.rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// POST : Générer une nouvelle clé
export async function POST(req: Request) {
  const { pubkey, name } = await req.json();
  if (!pubkey || !name) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    // Générer une clé aléatoire (sceau_live_ + 32 caractères hexadécimaux)
    const rawKey = `sceau_live_${crypto.randomBytes(16).toString('hex')}`;
    
    // On ne stocke que le hash SHA-256 de la clé en base de données
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await pool.query(
      "INSERT INTO api_keys (user_id, key_hash, name) VALUES ($1, $2, $3)",
      [user.rows[0].id, keyHash, name]
    );

    // On retourne la clé EN CLAIR une seule fois. Elle ne sera plus jamais visible.
    return NextResponse.json({ success: true, key: rawKey });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// DELETE : Révoquer une clé
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  const id = searchParams.get('id');

  if (!pubkey || !id) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });

    await pool.query("DELETE FROM api_keys WHERE id = $1 AND user_id = $2", [id, user.rows[0].id]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
