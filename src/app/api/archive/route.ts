import { NextResponse } from 'next/server';
const AI_URL = process.env.SCEAU_AI_URL || 'http://localhost:8080';
const AI_KEY = process.env.SCEAU_AI_KEY || '';

async function aiFetch(path: string, init?: RequestInit) {
  return fetch(`${AI_URL}${path}`, { ...init, headers: { ...(init?.headers || {}), 'X-SCEAU-AI-Key': AI_KEY, 'Content-Type': 'application/json' }, cache: 'no-store' });
}

export async function GET(req: Request) {
  try {
    const res = await aiFetch('/v1/sites');
    if (!res.ok) return NextResponse.json({ error: `AI: ${await res.text()}` }, { status: 502 });
    const data = await res.json();
    
    const sites = (data.sites || []).map((site: any) => {
      const pages = site.pages || [];
      const rootPage = pages.find((p: any) => p.url.replace(/\/+$/, '') === site.site_root.replace(/\/+$/, '')) || pages[0];
      return {
        root_id: String(rootPage.id), site_root: site.site_root, main_title: new URL(site.site_root).hostname,
        children_count: Math.max(0, pages.length - 1),
        children_modified: pages.filter((p: any) => p.current_hash !== p.v1_hash).length,
        scan_count: pages.reduce((s: number, p: any) => s + (p.current_version || 1), 0),
        last_checked_at: pages[0]?.last_scan_at || new Date().toISOString(),
        pages: pages.map((p: any) => ({ id: String(p.id), url: p.url, title: null, status: p.current_hash !== p.v1_hash ? 'modified' : 'intact', is_root: p.id === rootPage.id, last_checked_at: p.last_scan_at })),
        recent_changes: site.recent_changes.map((ch: any) => ({
          page_id: String(ch.archive_id), page_url: ch.page_url, page_title: null, changed_at: ch.changed_at,
          ai_summary: null, // On désactive pour voir le diff
          preview: { removed: ch.removed, added: ch.added }, // Le vrai diff est ici
        })),
      };
    });
    return NextResponse.json({ sites, is_pro: false, limit: 50 });
  } catch (e) { return NextResponse.json({ error: `Proxy AI injoignable: ${(e as Error).message}` }, { status: 502 }); }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === 'check') {
      const res = await aiFetch('/v1/check', { method: 'POST', body: JSON.stringify({ archive_id: Number(body.url) }) });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    const res = await aiFetch('/v1/crawl', { method: 'POST', body: JSON.stringify({ url: body.url }) });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) { return NextResponse.json({ error: `Proxy injoignable` }, { status: 502 }); }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  try {
    const res = await aiFetch(`/v1/archives/${searchParams.get('id')}`, { method: 'DELETE' });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: `Proxy injoignable` }, { status: 502 }); }
}
