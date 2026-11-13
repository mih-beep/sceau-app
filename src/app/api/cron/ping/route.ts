// Déclenche manuellement le passage du cron (pour tester), sans attendre minuit UTC.
//   curl -H "Authorization: Bearer $CRON_SECRET" https://VOTRE-SITE/api/cron/ping
// (l'ancienne forme ?secret=XXX reste acceptée, mais le secret apparaît alors dans les journaux d'accès)

import { NextResponse } from 'next/server';
import { cronGuard } from '@/lib/cron-auth';
import { runArchiveScan } from '@/lib/archive-scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = cronGuard(req, { allowQuerySecret: true });
  if (denied) return denied;
  try {
    const result = await runArchiveScan();
    return NextResponse.json({ triggered: true, result });
  } catch (e) {
    console.error('[cron/ping]', e);
    return NextResponse.json({ error: (e as Error).message || 'Erreur' }, { status: 500 });
  }
}
