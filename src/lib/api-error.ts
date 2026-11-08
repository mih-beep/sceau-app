import { NextResponse } from 'next/server';

function isDbError(e: any): boolean {
  const code = e?.code;
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '3D000', '57P01'].includes(code)) return true;
  return /ECONNREFUSED|ENOTFOUND|timeout|connect.*pool|database/i.test(String(e?.message || ''));
}

export function apiError(e: unknown, fallback = 'Erreur serveur'): NextResponse {
  if (isDbError(e)) {
    console.error('[api-error] base injoignable :', (e as any)?.message);
    return NextResponse.json(
      { error: 'Base de données injoignable. Réessayez dans un instant.' },
      { status: 503 }
    );
  }
  console.error('[api-error]', e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
