import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Protège les routes cron. Vercel envoie automatiquement `Authorization: Bearer <CRON_SECRET>`
 * quand la variable CRON_SECRET existe dans le projet.
 * - En production, si CRON_SECRET n'est PAS défini : tout est refusé (fail-closed).
 * - En développement local sans secret : accès autorisé pour faciliter les tests.
 * Renvoie null si l'accès est autorisé, sinon la réponse d'erreur à retourner.
 */
export function cronGuard(req: Request, opts: { allowQuerySecret?: boolean } = {}): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET non configuré sur le serveur (accès refusé).' }, { status: 503 });
    }
    return null;
  }
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (bearer && same(bearer, secret)) return null;
  if (opts.allowQuerySecret) {
    const q = new URL(req.url).searchParams.get('secret') || '';
    if (q && same(q, secret)) return null;
  }
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
}
