import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
export async function POST(req: Request) {
  try {
    const { hash, title, pubkey } = await req.json();
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const protocolRes = await fetch('http://localhost:8080/v1/seal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash, title }) });
    const protocolData = await protocolRes.json();
    await pool.query("INSERT INTO seals (hash, timestamp, author_id, title) VALUES (decode($1, 'base64'), $2, $3, $4)", [hash, protocolData.timestamp, user.rows[0].id, title]);
    return NextResponse.json(protocolData);
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}