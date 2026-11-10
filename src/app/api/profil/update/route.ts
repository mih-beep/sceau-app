import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { pubkey, old_handle, new_handle, bio, role, open_to_collaboration, first_name, last_name, birth_date } = await req.json();

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const userId = user.rows[0].id;

    if (new_handle && new_handle !== old_handle) {
      const check = await pool.query("SELECT id FROM users WHERE handle = $1", [new_handle]);
      if (check.rows.length > 0) return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 409 });
    }

    const finalHandle = new_handle || old_handle;
    
    // Vérification des changements d'identité
    const currentUser = await pool.query("SELECT first_name, last_name, birth_date, identity_changes_count, identity_history FROM users WHERE id = $1", [userId]);
    const current = currentUser.rows[0];
    let changesCount = current.identity_changes_count || 0;
    let history = current.identity_history || [];
    
    const identityChanged = (first_name !== current.first_name) || (last_name !== current.last_name) || (birth_date !== current.birth_date);

    if (identityChanged) {
      if (changesCount >= 3) {
        return NextResponse.json({ error: "Limite atteinte : vous ne pouvez modifier votre identité de confiance que 3 fois maximum." }, { status: 403 });
      }
      
      changesCount++;
      history.push({
        date: new Date().toISOString(),
        old_name: `${current.first_name || ''} ${current.last_name || ''}`.trim(),
        new_name: `${first_name || ''} ${last_name || ''}`.trim(),
        old_birth: current.birth_date,
        new_birth: birth_date
      });
    }

    await pool.query(
      "UPDATE users SET handle = $1, bio = $2, role = $3, open_to_collaboration = $4, first_name = $5, last_name = $6, birth_date = $7, identity_changes_count = $8, identity_history = $9 WHERE id = $10",
      [finalHandle, bio, role, open_to_collaboration === true, first_name || null, last_name || null, birth_date || null, changesCount, JSON.stringify(history), userId]
    );

    return NextResponse.json({ success: true, new_handle: finalHandle });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
