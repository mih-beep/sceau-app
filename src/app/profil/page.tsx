'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { generatePortfolioPDF } from '@/lib/pdf';
import AccessLogModal from './AccessLogModal';

export default function Profil() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('public');
  const [accessLogSealId, setAccessLogSealId] = useState<string | null>(null);

  async function loadProfil() {
    const handle = localStorage.getItem('sceau_handle');
    if (!handle) { router.replace('/login'); return; }

    try {
      const pubkey = localStorage.getItem('sceau_pubkey');
      const res = await fetch(`/api/profil?handle=${encodeURIComponent(handle)}${pubkey ? `&pubkey=${encodeURIComponent(pubkey)}` : ''}`, { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Impossible de charger le profil.");
      setData(d);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => { loadProfil(); }, [router]);

  async function changeVisibility(sealId: string, newVisibility: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/seal/update-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seal_id: sealId, pubkey, visibility: newVisibility })
    });
    loadProfil();
  }

  if (error) return <div className="p-10 text-center font-mono text-red-500">{error}</div>;
  if (!data) return <div className="p-10 text-center font-mono">Chargement de votre cockpit...</div>;

  const counts = {
    public: data.seals.filter((s:any) => s.visibility === 'public' && !s.is_flash).length,
    private: data.seals.filter((s:any) => s.visibility === 'private' && !s.is_flash).length,
    flash: data.seals.filter((s:any) => s.is_flash).length,
    extensions: data.seals.filter((s:any) => s.category === 'Web').length,
  };

  const filteredSeals = data.seals.filter((seal: any) => {
    if (activeTab === 'flash') return seal.is_flash === true;
    if (activeTab === 'public') return seal.visibility === 'public' && !seal.is_flash;
    if (activeTab === 'private') return seal.visibility === 'private' && !seal.is_flash;
    if (activeTab === 'extensions') return seal.category === 'Web';
    return false;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans relative w-full pb-32">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl shadow-lg">
            {data.handle[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" style={{color: 'var(--text-main)'}}>
              @{data.handle}
              {data.is_pro && <span className="text-xs bg-[#2C1810] text-[#E9C46A] px-2 py-1 rounded">PRO</span>}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">{data.role || 'Créateur vérifié'}</p>
          </div>
        </div>
        <Link href="/settings" className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2 rounded-xl text-xl hover:border-[#E76F51] transition">⚙️</Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl text-center shadow-sm">
          <div className="text-2xl font-bold text-[#E76F51]">{data.sealed}</div>
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase">Sceaux</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl text-center shadow-sm">
          <div className="text-2xl font-bold text-[#4A90C2]">{data.hosted}</div>
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase">Fichiers</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl text-center shadow-sm">
          <div className="text-2xl font-bold text-[#3F8F5C]">{data.friends_count}</div>
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase">Amis</div>
        </div>
      </div>

      {/* Actions Rapides */}
      <div className="flex gap-3 mb-8">
        <a href="/downloads/chrome-extension.zip" download className="flex-1 bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] p-3 rounded-xl font-bold text-center text-sm shadow-sm hover:bg-[#E0EDF8] transition">
          🧩 Télécharger l'Extension
        </a>
        <Link href={`/u/${data.handle}`} className="flex-1 bg-[var(--text-main)] text-[var(--bg-surface)] p-3 rounded-xl font-bold text-center text-sm shadow-md hover:opacity-80 transition">
          👁️ Profil public
        </Link>
        <button onClick={() => generatePortfolioPDF(data.handle, data.seals, '', '', data.is_pro)} className="flex-1 bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] p-3 rounded-xl font-bold text-sm hover:border-[#E76F51] transition">
          📄 Exporter Portfolio
        </button>
      </div>

      {/* Le Coffre (Tabs) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-[var(--border-color)]">
          <button onClick={() => setActiveTab('public')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A]' : 'opacity-50'}`}>🌍 Public ({counts.public})</button>
          <button onClick={() => setActiveTab('private')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E]' : 'opacity-50'}`}>🔒 Privé ({counts.private})</button>
          <button onClick={() => setActiveTab('flash')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'flash' ? 'bg-[#2C1810] text-white' : 'opacity-50'}`}>⚡ Flash ({counts.flash})</button>
          <button onClick={() => setActiveTab('extensions')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'extensions' ? 'bg-[#F0F6FC] text-[#2D6A9E]' : 'opacity-50'}`}>🔌 Ext ({counts.extensions})</button>
        </div>

        <div className="p-4 space-y-2">
          {filteredSeals.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)] italic py-8">Aucune œuvre dans ce compartiment.</p>
          ) : (
            filteredSeals.map((seal: any) => (
              <div key={seal.id} className="flex justify-between items-center p-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-main)] transition">
                <div>
                  <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAccessLogSealId(seal.id)} className="text-[#4A90C2] text-xs font-bold hover:underline">📖 Journal</button>
                  <Link href={`/o/${seal.id}`} className="text-xs bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-1 rounded-lg">Voir</Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {accessLogSealId && <AccessLogModal sealId={accessLogSealId} onClose={() => setAccessLogSealId(null)} />}
    </div>
  );
}
