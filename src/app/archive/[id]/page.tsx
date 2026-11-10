'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ArchiveDetail() {
  const params = useParams();
  const router = useRouter();
  const [archive, setArchive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadArchive = async () => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) { router.replace('/login'); return; }

    try {
      const res = await fetch(`/api/archive?pubkey=${encodeURIComponent(pubkey)}`);
      const d = await res.json();
      const found = (d.archives || []).find((a: any) => a.id === params.id);
      if (found) setArchive(found);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadArchive(); }, [params.id]);

  async function runCheck() {
    if (!archive) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return;

    setChecking(true);
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url: archive.id, action: 'check' })
    });
    const d = await res.json();
    await loadArchive();
    setChecking(false);
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;
  if (!archive) return <div className="p-10 text-center">Archive introuvable.</div>;

  const daysSinceStart = Math.floor((Date.now() - new Date(archive.created_at).getTime()) / 86400000);
  const isModified = archive.last_status === 'modified';
  const isError = archive.last_status === 'error';

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-3xl mx-auto font-sans w-full min-h-screen">
      <button onClick={() => router.back()} className="text-sm font-bold mb-4 flex items-center gap-2" style={{color: 'var(--text-muted)'}}>
        ← Retour à Archive
      </button>

      {/* Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold font-serif mb-1" style={{color: 'var(--text-main)'}}>
              {archive.title || archive.url}
            </h1>
            <a href={archive.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4A90C2] hover:underline break-all">
              {archive.url}
            </a>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${isModified ? 'bg-[#FDF4F0] text-[#C44A2E]' : isError ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
            {isModified ? '⚠️ Modifié' : isError ? '🔒 Inaccessible' : '✅ Intact'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[var(--border-color)] pt-4">
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Suivi depuis</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{daysSinceStart} jour{daysSinceStart > 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Dernier scan</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{new Date(archive.last_checked_at).toLocaleDateString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Scans effectués</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{archive.scan_count || 1}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-mono uppercase text-[var(--text-muted)]">Pages</p>
            <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{archive.pages_scanned || 1}</p>
          </div>
        </div>
      </div>

      {/* Résumé IA / Statut */}
      {!isModified && !isError && (
        <div className="bg-[#F0FAF4] border border-[#A8C77E] rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-sm text-[#3F8F5C] mb-2">✅ Aucun changement détecté</h3>
          <p className="text-sm text-[#5D7A3A]">
            Le contenu de cette page est identique à la dernière vérification du {new Date(archive.last_checked_at).toLocaleString('fr-FR')}.
            SCEAU surveille ce site en continu. Vous recevrez une alerte dès qu'un changement apparaîtra.
          </p>
        </div>
      )}

      {isError && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-sm text-orange-700 mb-2">🔒 Site inaccessible</h3>
          <p className="text-sm text-orange-600">
            Le dernier scan a échoué (site temporairement inaccessible ou bloquant). SCEAU réessaiera automatiquement.
          </p>
        </div>
      )}

      {/* Diff si modifié */}
      {isModified && archive.diff_data && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm mb-6">
          <div className="p-4 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-sm" style={{color: 'var(--text-main)'}}>🔍 Changements détectés</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">{archive.diff_data.changesCount} ligne(s) modifiée(s)</p>
          </div>
          <div className="p-4 font-mono text-xs bg-[var(--bg-main)] max-h-96 overflow-y-auto">
            {archive.diff_data.details?.map((line: any, i: number) => (
              <div key={i} className={`py-1 px-2 whitespace-pre-wrap ${
                line.type === 'added' ? 'bg-green-50 text-green-800 border-l-2 border-green-500' :
                line.type === 'removed' ? 'bg-red-50 text-red-800 border-l-2 border-red-500 line-through opacity-70' :
                'text-[var(--text-muted)]'
              }`}>
                <span className="opacity-50 mr-2">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                {line.text || ' '}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex-1 min-w-[180px] bg-[#1A1513] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition disabled:opacity-50"
        >
          {checking ? '⏳ Vérification...' : '🔄 Vérifier maintenant'}
        </button>
        <a
          href={archive.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[180px] bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] py-3 rounded-xl font-bold text-sm text-center hover:border-[#E76F51] transition"
        >
          🌐 Visiter le site
        </a>
      </div>
    </div>
  );
}
