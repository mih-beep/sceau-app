import { NextResponse } from 'next/server';

const AI_URL = process.env.SCEAU_AI_URL || 'http://localhost:8080';
const AI_KEY = process.env.SCEAU_AI_KEY || '';

async function aiFetch(path: string, init?: RequestInit) {
  return fetch(`${AI_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'X-SCEAU-AI-Key': AI_KEY,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
}

type AiPage = {
  id: number; url: string; v1_hash: string; current_hash: string;
  current_version: number; v1_ots_status: string | null;
  last_scan_at: string | null; last_change_at: string | null;
};
type AiSite = {
  site_root: string;
  pages: AiPage[];
  recent_changes: Array<{
    archive_id: number; page_url: string; version: number;
    new_hash: string; changed_at: string; diff_size: number;
  }>;
};

function hostnameOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  if (!pubkey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });

  try {
    const res = await aiFetch('/v1/sites');
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `AI: ${t}` }, { status: 502 });
    }
    const data = (await res.json()) as { sites: AiSite[] };

    const sites = (data.sites || []).map((site) => {
      const pages = site.pages || [];
      const rootPage =
        pages.find((p) =>
          p.url.replace(/\/+$/, '') === site.site_root.replace(/\/+$/, ''),
        ) || pages[0];

      const childrenModified = pages.filter((p) => p.current_hash !== p.v1_hash).length;
      const lastChecked = pages.reduce<string | null>((m, p) => {
        if (!p.last_scan_at) return m;
        if (!m) return p.last_scan_at;
        return new Date(p.last_scan_at) > new Date(m) ? p.last_scan_at : m;
      }, null);

      return {
        root_id: String(rootPage.id),
        site_root: site.site_root,
        main_title: hostnameOf(site.site_root),
        children_count: Math.max(0, pages.length - 1),
        children_modified: childrenModified,
        scan_count: pages.reduce((s, p) => s + (p.current_version || 1), 0),
        last_checked_at: lastChecked || new Date().toISOString(),
        pages: pages.map((p) => ({
          id: String(p.id),
          url: p.url,
          title: null,
          status: p.current_hash !== p.v1_hash ? 'modified' : 'intact',
          is_root: p.id === rootPage.id,
          last_checked_at: p.last_scan_at,
        })),
        recent_changes: site.recent_changes.map((ch) => ({
          page_id: String(ch.archive_id),
          page_url: ch.page_url,
          page_title: null,
          changed_at: ch.changed_at,
          ai_summary: `Version v${ch.version} (${ch.diff_size} octets)`,
          preview: { removed: null, added: null },
        })),
      };
    });

    return NextResponse.json({
      sites,
      is_pro: false,
      limit: 50,
    });
  } catch (e) {
    return NextResponse.json({ error: `Proxy AI injoignable: ${(e as Error).message}` }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    pubkey?: string; url?: string; action?: string; scope?: string;
  };
  const { pubkey, url, action } = body;
  if (!pubkey || !url) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    // Vérification (le champ url contient l'id de l'archive pour ce cas)
    if (action === 'check') {
      const archiveId = Number(url);
      if (!Number.isFinite(archiveId)) {
        return NextResponse.json({ error: 'id archive invalide' }, { status: 400 });
      }
      const res = await aiFetch('/v1/check', {
        method: 'POST',
        body: JSON.stringify({ archive_id: archiveId }),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    // Ajout d'une URL
    if (!url.startsWith('https://')) {
      return NextResponse.json({ error: 'HTTPS obligatoire' }, { status: 400 });
    }
    const res = await aiFetch('/v1/crawl', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    return NextResponse.json({ error: `Proxy AI injoignable: ${(e as Error).message}` }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');
  const id = searchParams.get('id');
  if (!pubkey || !id) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  try {
    const res = await aiFetch(`/v1/archives/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `AI: ${t}` }, { status: res.status });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: `Proxy AI injoignable: ${(e as Error).message}` }, { status: 502 });
  }
}
