// Endpoint pour déclencher le cron manuellement (pour tester)
// Utilisation : curl https://sceau-app.vercel.app/api/cron/ping?secret=XXX

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    // Appelle le vrai cron
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://sceau-app.vercel.app'}/api/cron/archive-scan`, {
      headers: { 'Authorization': `Bearer ${expectedSecret}` },
    });
    const data = await res.json();
    return NextResponse.json({ triggered: true, result: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}
