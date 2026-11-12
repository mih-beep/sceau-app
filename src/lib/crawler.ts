import { safeFetch } from './safe-fetcher';
import { parse } from 'node-html-parser';
import { submitToOts } from './ots';
import { sha256 } from '@noble/hashes/sha256';

const MAX_PAGES = 10; // Réduit pour Vercel (timeout 30s), le Cron fera le reste
const TIME_LIMIT_MS = 20000;

export type CrawledPage = {
  url: string;
  title: string;
  text: string;
  html: string;
  hash: string;
  ots_proof: string | null;
};

export async function crawlSite(startUrl: string): Promise<CrawledPage[]> {
  const startTime = Date.now();
  const visited = new Set<string>();
  const queue = [startUrl];
  const results: CrawledPage[] = [];

  while (queue.length > 0 && Date.now() - startTime < TIME_LIMIT_MS && results.length < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const res = await safeFetch(url);
    if (!res.ok) continue;

    // 1. Nettoyage et Hachage
    const root = parse(res.html);
    const text = root.textContent.replace(/\s+/g, ' ').trim();
    const hashBytes = sha256(new TextEncoder().encode(text));
    const hashHex = Buffer.from(hashBytes).toString('hex');

    // 2. Ancrage Bitcoin
    let otsProof = null;
    try {
      const ots = await submitToOts(hashBytes);
      if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
    } catch (e) {}

    results.push({
      url: res.finalUrl,
      title: root.querySelector('title')?.text || url,
      text,
      html: res.html,
      hash: hashHex,
      ots_proof: otsProof
    });

    // 3. Liens internes (typage strict)
    const base = new URL(url);
    root.querySelectorAll('a').forEach((a: any) => {
      try {
        const link = new URL(a.getAttribute('href') || '', url);
        if (link.hostname === base.hostname && link.protocol.startsWith('http') && !visited.has(link.toString())) {
          queue.push(link.toString());
        }
      } catch {}
    });
  }
  return results;
}
