import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  const { pact_id, pubkey } = await req.json();
  const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
  const myId = user.rows[0].id;

  try {
    await pool.query("INSERT INTO pact_signatures (pact_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [pact_id, myId]);

    const pact = await pool.query("SELECT * FROM pacts WHERE id = $1", [pact_id]);
    const sigs = await pool.query("SELECT user_id FROM pact_signatures WHERE pact_id = $1", [pact_id]);
    
    const required = pact.rows[0].required_signatures;
    const current = sigs.rows.length;

    // SI TOUT LE MONDE A SIGNÉ : On grave enfin le pacte dans la blockchain
    if (current >= required && pact.rows[0].status !== 'scelle') {
      const now = new Date().toISOString();
      const hashB64 = pact.rows[0].hash ? Buffer.from(pact.rows[0].hash).toString('base64') : '';
      
      // 1. Ancrage OpenTimestamps
      let otsProof = null;
      try {
        const otsRes = await fetch('https://a.pool.opentimestamps.org/digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: Buffer.from(hashB64, 'base64')
        });
        if (otsRes.ok) otsProof = Buffer.from(await otsRes.arrayBuffer()).toString('base64');
      } catch (e) { console.log("OTS failed", e); }

      // 2. On crée un sceau pour CHAQUE signataire
      for (const sig of sigs.rows) {
        await pool.query(
          `INSERT INTO seals (hash, timestamp, author_id, title, description, category, is_public, visibility, is_hosted, file_path, ots_proof) 
           VALUES (decode($1, 'base64'), $2, $3, $4, $5, $6, true, 'public', $7, $8, $9)`,
          [hashB64, now, sig.user_id, pact.rows[0].title, pact.rows[0].description, pact.rows[0].category, pact.rows[0].is_hosted, pact.rows[0].file_path, otsProof]
        );
      }

      await pool.query("UPDATE pacts SET status = 'scelle', created_at = $1 WHERE id = $2", [now, pact_id]);
      return NextResponse.json({ success: true, current, required, isNowSealed: true });
    }

    return NextResponse.json({ success: true, current, required, isNowSealed: false });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
