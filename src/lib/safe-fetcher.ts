// Module unique de téléchargement pour Archive, Cron et Oracle.
// Règles : HTTPS only, pas d'IP internes, robots.txt, timeout, taille max, redirections validées.

import { isAllowedByRobots } from './robots';

const USER_AGENT = 'SCEAU-Bot/1.0 (+https://sceau-app.vercel.app)';
const TIMEOUT_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

import dns from 'dns/promises';

async function isPrivateIp(hostname: string): Promise<boolean> {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  
  // 1. Vérification textuelle (rapide)
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) || /^169\.254\./.test(h) || /^fc00:/i.test(h) || /^fe80:/i.test(h)) {
    return true;
  }

  // 2. Vérification DNS (anti-rebinding)
  try {
    const addresses = await dns.resolve4(h);
    for (const ip of addresses) {
      if (
        /^10\./.test(ip) || /^127\./.test(ip) || /^192\.168\./.test(ip) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || /^169\.254\./.test(ip)
      ) return true;
    }
  } catch (e) {
    return true; // Si on ne peut pas résoudre, on bloque par précaution
  }
  return false;
}

function isSafeProtocol(url: URL): boolean {
  return url.protocol === 'https:';
}

export type FetchResult =
  | { ok: true; html: string; finalUrl: string; statusCode: number }
  | { ok: false; error: string; statusCode?: number };

export async function safeFetch(inputUrl: string): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    return { ok: false, error: 'URL invalide' };
  }

  if (!isSafeProtocol(url)) {
    return { ok: false, error: 'HTTPS obligatoire' };
  }

  if (await isPrivateIp(url.hostname)) {
    return { ok: false, error: 'Adresse interne interdite' };
  }

  if (url.username || url.password) {
    return { ok: false, error: 'URL avec identifiants interdite' };
  }

  // Vérifie robots.txt
  const allowed = await isAllowedByRobots(url.toString(), USER_AGENT);
  if (!allowed) {
    return { ok: false, error: 'Bloqué par robots.txt' };
  }

  let currentUrl = url.toString();
  let redirects = 0;

  while (redirects <= MAX_REDIRECTS) {
    try {
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'manual',
      });

      // Gère les redirections manuellement
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return { ok: false, error: 'Redirection sans location', statusCode: res.status };
        
        const nextUrl = new URL(location, currentUrl);
        if (!isSafeProtocol(nextUrl) || await isPrivateIp(nextUrl.hostname)) {
          return { ok: false, error: 'Redirection vers destination interdite', statusCode: res.status };
        }
        currentUrl = nextUrl.toString();
        redirects++;
        continue;
      }

      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}`, statusCode: res.status };
      }

      // Vérifie Content-Length
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_BYTES) {
        return { ok: false, error: 'Contenu trop lourd', statusCode: res.status };
      }

      // Lit en streaming avec limite
      const reader = res.body?.getReader();
      if (!reader) return { ok: false, error: 'Pas de body', statusCode: res.status };

      let bytes = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) {
          reader.cancel();
          return { ok: false, error: 'Contenu trop lourd', statusCode: res.status };
        }
        chunks.push(value);
      }

      const html = new TextDecoder().decode(Buffer.concat(chunks));
      return { ok: true, html, finalUrl: currentUrl, statusCode: res.status };
    } catch (e: any) {
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        return { ok: false, error: 'Timeout' };
      }
      return { ok: false, error: e?.message || 'Erreur réseau' };
    }
  }

  return { ok: false, error: 'Trop de redirections' };
}

// Le nettoyage du HTML vit dans un seul module (html-cleaner) pour tout le pipeline.
export { cleanHtmlToText } from './html-cleaner';

export function extractTitle(html: string, fallbackUrl: string): string {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t?.[1]) {
    const clean = t[1].replace(/\s+/g, ' ').trim();
    if (clean.length > 0 && clean.length < 200) return clean;
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    const clean = h1[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length > 0 && clean.length < 100) return clean;
  }
  try {
    const u = new URL(fallbackUrl);
    return u.pathname === '/' ? u.hostname : `${u.hostname}${u.pathname}`;
  } catch {
    return fallbackUrl;
  }
}
