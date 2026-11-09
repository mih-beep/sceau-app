import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const pact = await pool.query(`
      SELECT p.id, p.title, p.description, p.required_signatures, p.status, p.created_at, 
             u.handle as creator, 
             encode(p.hash, 'base64') as hash_str
      FROM pacts p JOIN users u ON p.creator_id = u.id 
      WHERE p.id = $1
    `, [id]);
    
    if (pact.rows.length === 0) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const signatures = await pool.query(
      "SELECT u.handle FROM pact_signatures s JOIN users u ON s.user_id = u.id WHERE s.pact_id = $1 ORDER BY s.created_at ASC", 
      [id]
    );
    
    return NextResponse.json({ 
      ...pact.rows[0], 
      signataires: signatures.rows.map(r => r.handle) 
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
