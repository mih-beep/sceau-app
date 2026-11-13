import { NextResponse } from 'next/server';
import { cronGuard } from '@/lib/cron-auth';
import { runArchiveScan } from '@/lib/archive-scan';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Appelé chaque nuit par Vercel Cron (vercel.json). Pour le tester à la main :
//   curl -H "Authorization: Bearer $CRON_SECRET" https://VOTRE-SITE/api/cron/archive-scan
export async function GET(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  try {
    const r = await runArchiveScan();
    console.log(`[cron] ${r.scanned} scannée(s), ${r.modified} modifiée(s), ${r.errors} erreur(s), ${r.skipped} reportée(s), ${r.backfilled} résumé(s) rattrapé(s) en ${r.ms} ms`);
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    return apiError(e, (e as Error).message || 'Cron Error');
  }
}
