'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pubkey, setPubkey] = useState('');
  const [data, setData] = useState<any>({ handle: '', bio: '', role: '' });

  useEffect(() => {
    const p = localStorage.getItem('sceau_pubkey');
    if (!p) { router.push('/login'); return; }
    setPubkey(p);

    fetch(`/api/profil?pubkey=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(d => { if (d.handle) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  function logout() {
    if(confirm("Se déconnecter de cet appareil ? Vos clés resteront sécurisées sur votre navigateur.")) {
      localStorage.clear();
      router.push('/login');
    }
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 pb-32 max-w-2xl mx-auto font-sans w-full">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profil" className="text-2xl opacity-50 hover:opacity-100 transition">←</Link>
        <h1 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>Paramètres</h1>
      </div>

      <div className="space-y-6">
        {/* Section Identité */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{color: 'var(--text-main)'}}>👤 Profil Public</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase block mb-1">Pseudo</label>
              <input type="text" value={`@${data.handle}`} disabled className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] p-3 rounded-xl text-[var(--text-muted)]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase block mb-1">Bio</label>
              <textarea disabled value={data.bio || ''} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] p-3 rounded-xl text-[var(--text-muted)]" rows={2} />
            </div>
            <p className="text-xs italic text-[var(--text-muted)] text-right">Pour modifier ces informations, passez par l'édition du profil (bientôt).</p>
          </div>
        </div>

        {/* Section Clé Cryptographique */}
        <div className="bg-[#FDF8F0] p-6 rounded-2xl border border-[#EFE0CA] shadow-sm">
          <h2 className="text-lg font-bold mb-2 text-[#A88620]">🔑 Clé d'Identité (Souveraine)</h2>
          <p className="text-xs text-[#7A5A3A] mb-3">C'est votre signature numérique. Ne la partagez jamais.</p>
          <div className="bg-white p-3 rounded-xl border border-[#EFE0CA] overflow-x-auto">
            <code className="text-xs font-mono text-gray-600 whitespace-nowrap">{pubkey}</code>
          </div>
        </div>

        {/* Section API */}
        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8] shadow-sm">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🔌 API & Intégrations</h2>
          <p className="text-xs text-[#2D6A9E] mb-4">Connectez SCEAU à vos propres outils (WordPress, GitHub, etc.).</p>
          <Link href="/settings/keys" className="inline-block bg-[#4A90C2] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-[#2D6A9E] transition">Gérer mes clés API</Link>
        </div>

        {/* Section Légal */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{color: 'var(--text-main)'}}>⚖️ Cadre Légal</h2>
          <div className="flex flex-col gap-2">
            <Link href="/legal" className="text-sm font-bold text-[#4A90C2] hover:underline">Conditions Générales d'Utilisation</Link>
            <Link href="/legal" className="text-sm font-bold text-[#4A90C2] hover:underline">Politique de Confidentialité (RGPD)</Link>
            <Link href="/legal" className="text-sm font-bold text-[#4A90C2] hover:underline">Mentions Légales</Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#FDF0F0] p-6 rounded-2xl border border-[#D64545]">
          <h2 className="text-lg font-bold mb-2 text-[#A02E2E]">⚠️ Zone sensible</h2>
          <p className="text-xs text-[#A02E2E] mb-4">Ces actions sont irréversibles.</p>
          <button onClick={logout} className="w-full border-2 border-[#D64545] text-[#D64545] py-2 rounded-xl font-bold hover:bg-[#D64545] hover:text-white transition">
            Se déconnecter de cet appareil
          </button>
        </div>
      </div>
    </div>
  );
}
