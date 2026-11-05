import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sealId = searchParams.get('id');
    const pubkey = searchParams.get('pubkey');

    if (!sealId || !pubkey) {
      return NextResponse.json({ error: 'ID ou clé manquant' }, { status: 400 });
    }

    // 1. Vérifier que l'utilisateur est bien le propriétaire
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    
    const seal = await pool.query("SELECT author_id, file_path FROM seals WHERE id = $1", [sealId]);
    if (seal.rows.length === 0) return NextResponse.json({ error: 'Sceau introuvable' }, { status: 404 });
    
    if (seal.rows[0].author_id !== user.rows[0].id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // 2. Supprimer le fichier physique s'il était hébergé
    if (seal.rows[0].file_path) {
      try {
        const filePath = join(process.cwd(), 'public', seal.rows[0].file_path);
        await unlink(filePath); // Supprime le fichier du disque
      } catch (e) { console.log("Fichier déjà supprimé ou introuvable"); }
    }

    // 3. Supprimer la ligne de la base de données
    await pool.query("DELETE FROM seals WHERE id = $1", [sealId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
