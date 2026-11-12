// Moteur de scan partagé : cron nocturne, bouton « Vérifier » et endpoint de test utilisent
// EXACTEMENT le même code (mêmes règles de téléchargement, nettoyage, diff et résumé).

import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';
import { Resend } from 'resend';
import { safeFetch, extractTitle } from '@/lib/safe-fetcher';
import { crawlSite } from '@/lib/crawler';
import { submitToOts } from '@/lib/ots';
import { cleanHtmlToText, significantDiff, CLEANER_VERSION, type LineDiff } from '@/lib/html-cleaner';
import { summarizeDiff, describeDiff } from '@/lib/oracle-summary';

export type ArchiveRow = {
  id: string;
  url: string;
  title: string | null;
  last_hash: string | null;
  last_content: string | null;
  clean_version: number | null;
  user_id?: string;
  email?: string | null;
};

export type ScanStatus = 'intact' | 'modified' | 'error';

export type ScanOutcome = {
  id: string;
  url: string;
  status: ScanStatus;
  baseline?: boolean;
  error?: string;
  added?: number;
  removed?: number;
  summary?: string | null;
  summaryError?: string;
  model?: string;
  hash?: string;
  lines?: number;
  logs: string[];
};

export function hashText(text: string): string {
  return Buffer.from(sha256(new TextEncoder().encode(text))).toString('hex');
}

// ---------------------------------------------------------------------------------------------
// Schéma : ajouté automatiquement et sans risque (IF NOT EXISTS) au premier usage.
// Évite d'avoir à lancer un script SQL à la main avant chaque déploiement.
// ---------------------------------------------------------------------------------------------
let schemaReady: Promise<void> | null = null;

export function ensureArchiveSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const stmts = [
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS site_root TEXT`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS last_content TEXT`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS last_status TEXT DEFAULT 'intact'`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'intact'`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS diff_data JSONB`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS pages_scanned INTEGER DEFAULT 1`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS ai_summary TEXT`,
        `ALTER TABLE web_archives ADD COLUMN IF NOT EXISTS clean_version INTEGER DEFAULT 1`,
        `CREATE TABLE IF NOT EXISTS web_archive_changes (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           archive_id UUID NOT NULL REFERENCES web_archives(id) ON DELETE CASCADE,
           detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           old_hash TEXT,
           new_hash TEXT,
           added_count INTEGER DEFAULT 0,
           removed_count INTEGER DEFAULT 0,
           diff_data JSONB,
           ai_summary TEXT,
           summary_model TEXT
         )`,
        `CREATE INDEX IF NOT EXISTS idx_archive_changes_archive ON web_archive_changes(archive_id, detected_at DESC)`,
      ];
      for (const s of stmts) {
        try {
          await pool.query(s);
        } catch (e) {
          console.warn('[archive schema]', (e as Error).message);
        }
      }
    })();
    // en cas d'échec global on retentera au prochain appel
    schemaReady.catch(() => {
      schemaReady = null;
    });
  }
  return schemaReady;
}

function diffPayload(diff: LineDiff) {
  const cut = (l: string) => l.slice(0, 300);
  return {
    changesCount: Math.max(diff.added.length, diff.removed.length),
    added: diff.added.length,
    removed: diff.removed.length,
    details: [
      ...diff.removed.slice(0, 50).map((t: string) => ({ type: 'removed', text: cut(t) })),
      ...diff.added.slice(0, 50).map((t: string) => ({ type: 'added', text: cut(t) })),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Scan d'UNE page
// ---------------------------------------------------------------------------------------------
export async function scanArchive(
  row: ArchiveRow,
  opts: { persist?: boolean; log?: (m: string) => void; baselineOverride?: string } = {}
): Promise<ScanOutcome> {
  const persist = opts.persist !== false;
  const logs: string[] = [];
  const log = (m: string) => {
    logs.push(m);
    console.log(`[scan ${row.id.slice(0, 8)}] ${m}`);
    opts.log?.(m);
  };
  const out = (o: Omit<ScanOutcome, 'id' | 'url' | 'logs'>): ScanOutcome => ({ id: row.id, url: row.url, logs, ...o });

  if (persist) await ensureArchiveSchema();

  // 1. Téléchargement sécurisé + Crawl BFS
  log(`1/5 téléchargement de ${row.url}`);
  
  // On utilise notre Crawler (qui respecte safe-fetcher, robots.txt et fait le BFS)
  const pages = await crawlSite(row.url);
  if (pages.length === 0) {
    log(`✗ échec du téléchargement : aucune page trouvée`);
    if (persist) await pool.query('UPDATE web_archives SET last_checked_at = NOW() WHERE id = $1', [row.id]).catch(() => {});
    return out({ status: 'error', error: 'Aucune page trouvée' });
  }
  
  // On prend la page principale pour le diff (la première du tableau)
  const f = pages[0];
  log(`   ${pages.length} page(s) scannée(s). ${f.text.length} caractères sur la page principale.`);

  // 2. Nettoyage (déjà fait par le crawler, mais on garde la variable pour le diff)
  const text = f.text;
  const lines = text ? text.split('\n').length : 0;
  log(`2/5 nettoyage : ${lines} lignes de contenu utile (${text.length} caractères)`);
  if (text.length < 20) {
    log('✗ contenu vide après nettoyage (page vide, protégée, ou affichée uniquement par JavaScript)');
    if (persist) await pool.query('UPDATE web_archives SET last_checked_at = NOW() WHERE id = $1', [row.id]).catch(() => {});
    return out({ status: 'error', error: 'Contenu vide après nettoyage (page rendue par JavaScript ou protégée)', lines });
  }

  // 3. Empreinte + Ancrage Bitcoin
  const hash = hashText(text);
  log(`3/5 empreinte SHA-256 : ${hash.slice(0, 16)}…`);

  // Ancrage OpenTimestamps
  let otsProof = null;
  try {
    const ots = await submitToOts(new Uint8Array(Buffer.from(hash, 'hex')));
    if (ots.ok && ots.proof) {
      otsProof = ots.proof.toString('base64');
      log(`   ⛓️ ancrage Bitcoin réussi`);
    }
  } catch (e) {
    log(`   ⚠️ ancrage Bitcoin échoué`);
  }

  const baselineText = opts.baselineOverride ?? row.last_content;
  const hasBaseline = !!baselineText && !!row.last_hash && (opts.baselineOverride !== undefined || (row.clean_version ?? 1) >= CLEANER_VERSION);

  // 4a. Première capture, ou capture faite avec l'ancien format de nettoyage : nouvelle référence
  if (!hasBaseline) {
    log('4/5 pas de référence compatible → cette capture devient la référence (aucune alerte)');
    if (persist) {
      await pool.query(
        `UPDATE web_archives SET last_hash = $1, last_content = $2, clean_version = $3, last_status = 'intact', status = 'intact',
           last_checked_at = NOW(), scan_count = COALESCE(scan_count, 0) + 1, title = COALESCE(NULLIF(title, ''), $4)
         WHERE id = $5`,
        [hash, text, CLEANER_VERSION, extractTitle(f.html, row.url), row.id]
      );
    }
    return out({ status: 'intact', baseline: true, hash, lines });
  }

  // 4b. Identique
  if (hash === row.last_hash && opts.baselineOverride === undefined) {
    log('4/5 contenu identique → intact');
    if (persist) {
      await pool.query(
        `UPDATE web_archives SET last_status = 'intact', status = 'intact', last_checked_at = NOW(), scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $1`,
        [row.id]
      );
    }
    return out({ status: 'intact', hash, lines });
  }

  // 4c. Différent : calcul du diff par le code, puis filtre des lignes « temporelles »
  const diff = significantDiff(baselineText as string, text);
  if (diff.added.length + diff.removed.length === 0) {
    log('4/5 seules des lignes temporelles ont changé (date de mise à jour, compteurs…) → ignoré');
    if (persist) {
      await pool.query(
        `UPDATE web_archives SET last_hash = $1, last_content = $2, last_status = 'intact', status = 'intact', last_checked_at = NOW(),
           scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $3`,
        [hash, text, row.id]
      );
    }
    return out({ status: 'intact', hash, lines });
  }
  log(`4/5 changement significatif : ${diff.removed.length} ligne(s) retirée(s), ${diff.added.length} ajoutée(s)`);

  // 5. Résumé IA (jamais bloquant : si Groq échoue, le changement est quand même enregistré)
  log('5/5 résumé IA…');
  const s = await summarizeDiff(diff, row.url);
  if (s.summary) log(`   ✓ résumé (${s.model}) : ${s.summary}`);
  else log(`   ✗ résumé indisponible (${s.error}) → « résumé IA en attente », nouvel essai au prochain passage`);

  if (persist) {
    const payload = diffPayload(diff);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE web_archives SET last_status = 'modified', status = 'modified', last_checked_at = NOW(), diff_data = $1, last_hash = $2,
           last_content = $3, ai_summary = $4, clean_version = $5, scan_count = COALESCE(scan_count, 0) + 1, ots_proof = $7 WHERE id = $6`,
        [JSON.stringify(payload), hash, text, s.summary, CLEANER_VERSION, row.id, otsProof]
      );
      await client.query(
        `INSERT INTO web_archive_changes (archive_id, old_hash, new_hash, added_count, removed_count, diff_data, ai_summary, summary_model)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [row.id, row.last_hash, hash, diff.added.length, diff.removed.length, JSON.stringify(payload), s.summary, s.model ?? null]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  return out({
    status: 'modified',
    added: diff.added.length,
    removed: diff.removed.length,
    summary: s.summary,
    summaryError: s.error,
    model: s.model,
    hash,
    lines,
  });
}

// ---------------------------------------------------------------------------------------------
// Résumés manquants : on retente ceux dont Groq avait échoué (7 derniers jours)
// ---------------------------------------------------------------------------------------------
export async function backfillSummaries(max = 5): Promise<number> {
  await ensureArchiveSchema();
  let done = 0;
  const q = await pool.query(
    `SELECT c.id, c.archive_id, c.diff_data, a.url
     FROM web_archive_changes c JOIN web_archives a ON a.id = c.archive_id
     WHERE c.ai_summary IS NULL AND c.detected_at > NOW() - INTERVAL '7 days'
     ORDER BY c.detected_at DESC LIMIT $1`,
    [max]
  );
  for (const r of q.rows as { id: string; archive_id: string; diff_data: { details?: { type: string; text: string }[] } | null; url: string }[]) {
    const details = r.diff_data?.details || [];
    const diff: LineDiff = {
      removed: details.filter((d) => d.type === 'removed').map((d) => d.text),
      added: details.filter((d) => d.type === 'added').map((d) => d.text),
    };
    const s = await summarizeDiff(diff, r.url);
    if (!s.summary) continue;
    await pool.query('UPDATE web_archive_changes SET ai_summary = $1, summary_model = $2 WHERE id = $3', [s.summary, s.model ?? null, r.id]);
    await pool.query(
      `UPDATE web_archives SET ai_summary = $1 WHERE id = $2 AND ai_summary IS NULL AND COALESCE(last_status, status) = 'modified'`,
      [s.summary, r.archive_id]
    );
    done++;
  }
  return done;
}

// ---------------------------------------------------------------------------------------------
// E-mail d'alerte (le contenu vient d'un site tiers et de l'IA : tout est échappé)
// ---------------------------------------------------------------------------------------------
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function notify(resend: Resend, row: ArchiveRow, o: ScanOutcome): Promise<void> {
  if (!row.email) return;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://sceau-app.vercel.app').replace(/\/+$/, '');
  const from = process.env.MAIL_FROM || 'SCEAU Archive <onboarding@resend.dev>';
  const summary = o.summary ? esc(o.summary) : `${o.removed ?? 0} ligne(s) retirée(s), ${o.added ?? 0} ajoutée(s)`;
  const r = await resend.emails.send({
    from,
    to: row.email,
    subject: `Modification détectée sur ${row.url.slice(0, 80)}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#E76F51">SCEAU Archive</h2>
      <p>Une modification a été détectée sur une page que vous surveillez :</p>
      <p><a href="${esc(row.url)}">${esc(row.url)}</a></p>
      <p><strong>${summary}</strong></p>
      <p><a href="${esc(appUrl)}/archive" style="background:#1A1513;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Voir le détail</a></p>
    </div>`,
  });
  if (r.error) console.error('[cron] e-mail non envoyé :', r.error.message);
}

// ---------------------------------------------------------------------------------------------
// Passage complet (cron) : toutes les pages, par lots, dans la limite de temps de la fonction
// ---------------------------------------------------------------------------------------------
export async function runArchiveScan(opts: { limit?: number; budgetMs?: number } = {}) {
  await ensureArchiveSchema();
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  const q = await pool.query(
    `SELECT a.id, a.url, a.title, a.last_hash, a.last_content, a.clean_version, a.user_id, u.email
     FROM web_archives a JOIN users u ON a.user_id = u.id
     ORDER BY a.last_checked_at ASC NULLS FIRST LIMIT $1`,
    [limit]
  );
  const rows = q.rows as ArchiveRow[];
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const results: { url: string; status: ScanStatus; error?: string; summary?: string | null }[] = [];
  let scanned = 0;
  let modified = 0;
  let errors = 0;
  let skipped = 0;
  const BATCH = 4;

  for (let i = 0; i < rows.length; i += BATCH) {
    if (Date.now() - started > budget) {
      skipped = rows.length - i;
      console.warn(`[cron] budget de temps atteint : ${skipped} page(s) reportée(s) au prochain passage`);
      break;
    }
    const batch = rows.slice(i, i + BATCH);
    const outs = await Promise.all(
      batch.map((row) =>
        scanArchive(row).catch((e): ScanOutcome => ({
          id: row.id,
          url: row.url,
          status: 'error',
          error: (e as Error).message,
          logs: [],
        }))
      )
    );
    for (let j = 0; j < outs.length; j++) {
      const o = outs[j];
      results.push({ url: o.url, status: o.status, error: o.error, summary: o.summary });
      if (o.status === 'error') errors++;
      else scanned++;
      if (o.status === 'modified') {
        modified++;
        if (resend) await notify(resend, batch[j], o).catch((e) => console.error('[cron] e-mail :', (e as Error).message));
      }
    }
  }

  let backfilled = 0;
  try {
    if (Date.now() - started < budget) backfilled = await backfillSummaries(5);
  } catch (e) {
    console.warn('[cron] rattrapage des résumés :', (e as Error).message);
  }

  return { total: rows.length, scanned, modified, errors, skipped, backfilled, ms: Date.now() - started, results };
}

export { describeDiff };
