import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';

export async function POST(req: Request) {
  try {
    const { pubkey, github_username } = await req.json();
    
    // 1. Sauvegarder le pseudo GitHub
    await pool.query("UPDATE users SET github_username = $1 WHERE encode(pubkey, 'base64') = $2", [github_username, pubkey]);
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    const userId = user.rows[0].id;

    // 2. Récupérer les derniers commits publics via l'API GitHub
    const ghRes = await fetch(`https://api.github.com/users/${github_username}/events/public`, {
      headers: { 'User-Agent': 'SCEAU-App' }
    });
    const events = await ghRes.json();
    
    let commitsScelles = 0;
    for (const event of events) {
      if (event.type === 'PushEvent' && event.payload.commits.length > 0) {
        for (const commit of event.payload.commits) {
          // On crée un hash basé sur le message et l'ID du commit
          const hashStr = `${commit.sha}-${commit.message}`;
          const hash = sha256(new TextEncoder().encode(hashStr));
          let hashB64 = btoa(String.fromCharCode(...hash));

          // On insère dans la base (ON CONFLICT DO NOTHING pour éviter les doublons)
          await pool.query(
            `INSERT INTO seals (hash, timestamp, author_id, title, category, work_type, is_public) 
             VALUES (decode($1, 'base64'), $2, $3, $4, 'Code', 'commit', true) ON CONFLICT DO NOTHING`,
            [hashB64, event.created_at, userId, `Commit: ${commit.message.slice(0, 50)}`]
          );
          commitsScelles++;
        }
      }
    }
    return NextResponse.json({ success: true, commitsScelles });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur GitHub' }, { status: 500 });
  }
}
