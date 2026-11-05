import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { pubkey, recovery_email } = await req.json();
    await pool.query(
      "UPDATE users SET recovery_email = $1 WHERE encode(pubkey, 'base64') = $2",
      [recovery_email, pubkey]
    );
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
