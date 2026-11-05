import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    // On récupère TOUTES les nouvelles données depuis l'interface
    const { hash, title, pubkey, category, isHosted, filePath } = await req.json();

    if (!hash || !title || !pubkey) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }

    // 1. Trouver l'auteur
    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", 
      [pubkey]
    );
    
    if (user.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable. Inscris-toi d\'abord.' }, { status: 401 });
    }

    // 2. Appeler le protocole (ton stub)
    const protocolRes = await fetch('http://localhost:8080/v1/seal', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ hash, title }) 
    });
    
    if (!protocolRes.ok) throw new Error('Le protocole a échoué');
    const protocolData = await protocolRes.json();

    // 3. Sauvegarder en base
    await pool.query(
      `INSERT INTO seals (hash, timestamp, author_id, title, category, is_hosted, file_path) 
       VALUES (decode($1, 'base64'), $2, $3, $4, $5, $6, $7)`,
      [hash, protocolData.timestamp, user.rows[0].id, title, category || 'Art', isHosted || false, filePath || null]
    );

    return NextResponse.json(protocolData);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur lors du scellement' }, { status: 500 });
  }
}
