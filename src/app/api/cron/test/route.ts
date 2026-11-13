// Scan IMMÉDIAT d'une URL, avec le journal détaillé de chaque étape. Ne modifie rien par défaut.
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        "https://VOTRE-SITE/api/cron/test?url=https://example.com"
//
// Paramètres :
//   url=...        page à analyser (obligatoire, HTTPS)
//   simulate=1     simule une ancienne version différente pour tester le diff ET le résumé IA
//   archive_id=... compare avec la référence d'une archive existante
//   persist=1      (avec archive_id) enregistre vraiment le résultat, comme le ferait le cron

import { NextResponse } from 'next/server';
import { cronGuard } from '@/lib/cron-auth';
import { pool } from '@/db/pool';
import { scanArchive, ensureArchiveSchema, type ArchiveRow } from '@/lib/archive-scan';
import { groqStatus } from '@/lib/groq';
import { CLEANER_VERSION } from '@/lib/html-cleaner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const archiveId = searchParams.get('archive_id');
  let url = searchParams.get('url') || '';
  const simulate = searchParams.get('simulate') === '1';
  const persist = searchParams.get('persist') === '1';

  try {
    await ensureArchiveSchema();
    let row: ArchiveRow | null = null;

    if (archiveId) {
      const q = await pool.query(
        'SELECT id, url, title, last_hash, last_content, clean_version, user_id FROM web_archives WHERE id = $1',
        [archiveId]
      );
      row = (q.rows[0] as ArchiveRow) || null;
      if (!row) return NextResponse.json({ error: 'archive_id inconnu' }, { status: 404 });
      url = row.url;
    }
    if (!url) {
      return NextResponse.json({ error: 'Paramètre url manquant. Exemple : /api/cron/test?url=https://example.com' }, { status: 400 });
    }
    if (persist && !row) {
      return NextResponse.json({ error: 'persist=1 nécessite archive_id' }, { status: 400 });
    }

    const groq = await groqStatus();

    // Pour un test "à blanc" sans archive, on cherche quand même une référence existante pour cette URL
    if (!row) {
      const q = await pool.query(
        'SELECT id, url, title, last_hash, last_content, clean_version, user_id FROM web_archives WHERE url = $1 ORDER BY last_checked_at DESC LIMIT 1',
        [url]
      );
      row = (q.rows[0] as ArchiveRow) || {
        id: '00000000-0000-0000-0000-000000000000',
        url,
        title: null,
        last_hash: null,
        last_content: null,
        clean_version: null,
      };
    }

    // Mode simulation : fabrique une "ancienne version" pour exercer le diff et le résumé IA
    let baselineOverride: string | undefined;
    if (simulate) {
      const lines = await currentLines(url);
      const old = lines.slice(0, Math.max(lines.length - 2, 1));
      old.push('Ancienne ligne de test : tarif Pro 49 €');
      baselineOverride = old.join('\n');
      row = { ...row, last_hash: 'simulated', clean_version: CLEANER_VERSION };
    }

    const outcome = await scanArchive(row, { persist, baselineOverride });
    return NextResponse.json({
      ok: outcome.status !== 'error',
      mode: persist ? 'persist' : simulate ? 'simulation (rien enregistré)' : 'lecture seule (rien enregistré)',
      groq,
      outcome,
    });
  } catch (e) {
    console.error('[cron/test]', e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

async function currentLines(url: string): Promise<string[]> {
  const { safeFetch } = await import('@/lib/safe-fetcher');
  const { cleanHtmlToText } = await import('@/lib/html-cleaner');
  const f = await safeFetch(url);
  return f.ok ? cleanHtmlToText(f.html).split('\n') : [];
}
