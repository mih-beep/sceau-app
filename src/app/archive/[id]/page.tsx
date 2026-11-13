'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Change = {
  page_id: string;
  page_url: string;
  page_title: string | null;
  changed_at: string;
  ai_summary: string | null;
  preview?: { removed: string | null; added: string | null };
};
type PageNode = {
  id: string;
  url: string;
  title: string | null;
  status: string | null;
  is_root: boolean;
  last_checked_at: string | null;
};
type Site = {
  root_id: string;
  site_root: string;
  main_title: string;
  children_count: number;
  children_modified: number;
  scan_count: number;
  last_checked_at: string;
  pages: PageNode[];
  recent_changes: Change[];
};

// Les liens externes ne doivent jamais pouvoir être "javascript:" : on n'accepte que https
const safeHref = (u: string) => (/^https:\/\//i.test(u) ? u : '#');

function pageLabel(p: { title?: string | null; page_title?: string | null; url?: string; page_url?: string }): string {
  const t = p.title || p.page_title;
  if (t) return t;
  const u = p.url || p.page_url || '';
  try {
    const x = new URL(u);
    return x.pathname === '/' ? x.hostname : `${x.hostname}${x.pathname}`;
  } catch {
    return u;
  }
}

// Une notification de changement : 📄 page · 🧠 résumé · 🔗 lien vers la page
function ChangeCard({ change }: { change: Change }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 hover:shadow-md transition">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base shrink-0">📄</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm truncate" style={{ color: 'var(--text-main)' }}>
            {pageLabel(change)}
          </h3>
          <p className="text-[0.65rem] text-[var(--text-muted)] font-mono mt-0.5">
            {new Date(change.changed_at).toLocaleString('fr-FR')}
          </p>
        </div>
      </div>

      {change.ai_summary ? (
        <div className="bg-[#F0F6FC] border-l-4 border-[#4A90C2] rounded-r-lg p-3 mb-2">
          <p className="text-sm italic text-[var(--text-main)]">🧠 « {change.ai_summary} »</p>
        </div>
      ) : (
        <div className="mb-2">
          <p className="text-sm italic text-[var(--text-muted)] mb-1">Modification détectée (résumé IA en attente)</p>
          {(change.preview?.removed || change.preview?.added) && (
            <div className="text-xs font-mono rounded-lg border border-[var(--border-color)] p-2 space-y-1">
              {change.preview?.removed && <p className="text-red-600 break-words">− {change.preview.removed}</p>}
              {change.preview?.added && <p className="text-green-700 break-words">+ {change.preview.added}</p>}
            </div>
          )}
        </div>
      )}

      <a
        href={safeHref(change.page_url)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-bold text-[#4A90C2] hover:underline break-all"
      >
        🔗 Voir la page →
      </a>
    </div>
  );
}

export default function ArchiveDetail() {
  const params = useParams();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadArchive = async () => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) {
      router.replace('/login');
      return;
    }
    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      // l'identifiant de l'URL peut être celui de la racine OU celui de n'importe quelle page du site
      const found = (d.sites || []).find(
        (s: Site) => s.root_id === params.id || s.pages.some((p) => p.id === params.id)
      );
      if (found) setSite(found);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadArchive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function runCheck() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey || !site) return;
    setChecking(true);
    try {
      const res = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, url: site.root_id, action: 'check', scope: 'site' }),
      });
      const d = await res.json();
      if (!res.ok) alert(d.error || 'Vérification impossible');
    } catch {
      alert('Vérification impossible');
    }
    await loadArchive();
    setChecking(false);
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!site) return <div className="p-10 text-center">Archive introuvable.</div>;

  const root = site.pages.find((p) => p.is_root) || site.pages[0];
  const children = site.pages.filter((p) => p.id !== root.id);
  const changesOf = (id: string) => site.recent_changes.filter((c) => c.page_id === id).slice(0, 3);

  const PageHead = ({ p, isRoot }: { p: PageNode; isRoot?: boolean }) => (
    <div
      className={`bg-[var(--bg-surface)] border rounded-2xl p-4 ${
        p.status === 'modified' ? 'border-[#FCE0D6]' : 'border-[var(--border-color)]'
      } ${isRoot ? 'shadow-sm' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.status === 'modified' ? 'bg-red-500' : 'bg-green-500'}`}></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-main)' }}>
            {isRoot ? '🌐 ' : ''}
            {pageLabel(p)}
          </p>
          <a
            href={safeHref(p.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#4A90C2] hover:underline break-all"
          >
            {p.url}
          </a>
        </div>
        {p.status === 'modified' && (
          <span className="text-[0.65rem] font-bold text-[#C44A2E] uppercase shrink-0">Modifiée</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-3xl mx-auto font-sans w-full min-h-screen">
      <button
        onClick={() => router.push('/archive')}
        className="text-sm font-bold mb-4 flex items-center gap-2 opacity-60 hover:opacity-100"
        style={{ color: 'var(--text-main)' }}
      >
        ← Retour
      </button>

      {/* HEADER RACINE */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold font-serif break-words leading-tight mb-1" style={{ color: 'var(--text-main)' }}>
              {site.main_title}
            </h1>
            <a
              href={safeHref(site.site_root)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#4A90C2] hover:underline break-all"
            >
              {site.site_root}
            </a>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 whitespace-nowrap ${
              site.children_modified > 0
                ? 'bg-[#FDF4F0] text-[#C44A2E] border-2 border-[#FCE0D6]'
                : 'bg-green-50 text-green-700 border-2 border-green-200'
            }`}
          >
            {site.children_modified > 0
              ? `⚠️ ${site.children_modified} page${site.children_modified > 1 ? 's' : ''} modifiée${site.children_modified > 1 ? 's' : ''}`
              : '✅ Intact'}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-color)]">
          <span>
            📄 {site.children_count + 1} page{site.children_count > 0 ? 's' : ''} surveillée{site.children_count > 0 ? 's' : ''}
          </span>
          <span>
            🔄 {site.scan_count} scan{site.scan_count > 1 ? 's' : ''}
          </span>
          <span>📅 Vérifié {new Date(site.last_checked_at).toLocaleString('fr-FR')}</span>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex-1 min-w-[180px] bg-[#1A1513] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition disabled:opacity-50"
        >
          {checking ? '⏳ Vérification...' : '🔄 Vérifier tout le site'}
        </button>
        <a
          href={safeHref(site.site_root)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[180px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] py-3 rounded-xl font-bold text-sm text-center hover:border-[#E76F51] transition"
        >
          🌐 Visiter le site
        </a>
      </div>

      {/* ARBRE : racine → pages → changements imbriqués */}
      <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>
        🌳 Arborescence et changements
      </h2>

      <div className="space-y-3">
        {/* Racine */}
        <PageHead p={root} isRoot />
        {changesOf(root.id).length > 0 && (
          <div className="ml-5 pl-4 border-l-2 border-[#4A90C2]/40 space-y-3">
            {changesOf(root.id).map((c, i) => (
              <ChangeCard key={`r${i}`} change={c} />
            ))}
          </div>
        )}

        {/* Enfants */}
        {children.length > 0 && (
          <div className="ml-5 pl-4 border-l-2 border-[var(--border-color)] space-y-3">
            {children.map((p) => (
              <div key={p.id} className="space-y-3">
                <PageHead p={p} />
                {changesOf(p.id).length > 0 && (
                  <div className="ml-5 pl-4 border-l-2 border-[#4A90C2]/40 space-y-3">
                    {changesOf(p.id).map((c, i) => (
                      <ChangeCard key={`${p.id}-${i}`} change={c} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {site.recent_changes.length === 0 && site.children_modified === 0 && (
        <div className="bg-[#F0FAF4] border-2 border-[#A8C77E] rounded-2xl p-6 text-center mt-6">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="font-bold text-[#3F8F5C] mb-2">Aucun changement détecté</h3>
          <p className="text-sm text-[#5D7A3A]">
            Le site est surveillé. Vous serez alerté au moindre changement sur l’une des {site.children_count + 1} page
            {site.children_count > 0 ? 's' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}
