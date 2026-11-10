// Cache mémoire des robots.txt (TTL 1h)
const cache = new Map<string, { rules: string[]; allowAll: boolean; expires: number }>();
const TTL = 3600_000;

export async function isAllowedByRobots(url: string, userAgent = 'SCEAU-Bot'): Promise<boolean> {
  try {
    const u = new URL(url);
    const root = `${u.protocol}//${u.hostname}`;
    const cached = cache.get(root);
    if (cached && cached.expires > Date.now()) {
      return evaluate(cached, u.pathname, userAgent);
    }

    const res = await fetch(`${root}/robots.txt`, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Pas de robots.txt = tout autorisé
      const entry = { rules: [], allowAll: true, expires: Date.now() + TTL };
      cache.set(root, entry);
      return true;
    }

    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim());
    const rules: string[] = [];
    let inOurSection = false;
    let allowAll = false;

    for (const line of lines) {
      if (line.startsWith('#') || !line) continue;
      const [key, ...rest] = line.split(':');
      const k = key.trim().toLowerCase();
      const v = rest.join(':').trim();
      
      if (k === 'user-agent') {
        inOurSection = v === '*' || v.toLowerCase().includes('sceau');
        if (inOurSection && v === '*') allowAll = true;
      } else if (inOurSection && (k === 'disallow' || k === 'allow')) {
        rules.push(`${k}:${v}`);
      }
    }

    const entry = { rules, allowAll, expires: Date.now() + TTL };
    cache.set(root, entry);
    return evaluate(entry, u.pathname, userAgent);
  } catch {
    // Erreur réseau : on refuse par prudence
    return false;
  }
}

function evaluate(entry: { rules: string[]; allowAll: boolean }, path: string, _ua: string): boolean {
  // Règles les plus longues d'abord (spécifiques)
  const sorted = [...entry.rules].sort((a, b) => {
    const al = a.split(':').slice(1).join(':').length;
    const bl = b.split(':').slice(1).join(':').length;
    return bl - al;
  });

  for (const rule of sorted) {
    const [type, pattern] = rule.split(':');
    if (!pattern) {
      if (type === 'disallow') return false;
      continue;
    }
    const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'));
    if (regex.test(path)) {
      return type === 'allow';
    }
  }

  return true; // Par défaut, autorisé
}
