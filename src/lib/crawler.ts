import { safeFetch } from './safe-fetcher';
import { parse } from 'node-html-parser';
import { submitToOts } from './ots';
import { sha256 } from '@noble/hashes/sha256';

const MAX_PAGES = 200;
const TIME_LIMIT_MS = 25000;

export async function crawlSite(startUrl: string) {
  const startTime = Date.now();
  const visited = new Set<string>();
  const queue = [startUrl];
  const results: any[] = [];

  while (queue.length > 0 && Date.now() - startTime < TIME_LIMIT_MS && results.length < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const res = await safeFetch(url);
    if (!res.ok) continue;

    // 1. Hachage
    const text = parse(res.html).text;
    const hashBytes = sha256(new TextEncoder().encode(text));
    const hashHex = Buffer.from(hashBytes).toString('hex');

    // 2. Ancrage Bitcoin (OpenTimestamps)
    const ots = await submitToOts(hashBytes);
    
    results.push({
      url: res.finalUrl,
      title: parse(res.html).querySelector('title')?.text || url,
      content: text,
      hash: hashHex,
      ots_proof: ots.ok ? ots.proof?.toString('base64') : null
    });

    // 3. Extraction des liens internes
    const base = new URL(url);
    parse(res.html).querySelectorAll('a').forEach(a => {
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
