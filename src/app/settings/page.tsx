'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [oldHandle, setOldHandle] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState('createur');
  const [openToCollab, setOpenToCollab] = useState(false);
  const [pubkey, setPubkey] = useState('');

  useEffect(() => {
    const h = localStorage.getItem('sceau_handle');
    const p = localStorage.getItem('sceau_pubkey');
    if (!h || !p) { router.push('/login'); return; }

    setOldHandle(h);
    setNewHandle(h);
    setPubkey(p);

    fetch(`/api/profil?pubkey=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(d => {
        if (d.handle) {
          setBio(d.bio || '');
          setRole(d.role || 'createur');
          setOpenToCollab(d.open_to_collaboration === true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  async function saveProfile() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/profil/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey,
        old_handle: oldHandle,
        new_handle: newHandle,
        bio,
        role,
        open_to_collaboration: openToCollab,
      }),
    });
    const data = await res.json();

    if (res.ok) {
      setMsg('✅ Profil mis à jour !');
      localStorage.setItem('sceau_handle', data.new_handle);
      setOldHandle(data.new_handle);
    } else {
      setMsg('❌ ' + data.error);
    }
    setSaving(false);
  }

  function logout() {
    localStorage.clear();
    router.push('/login');
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto font-sans">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profil" className="text-2xl opacity-50 hover:opacity-100 transition">←</Link>
        <h1 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>Paramètres.</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{color: 'var(--text-main)'}}>👤 Identité publique</h2>

          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 font-mono">Pseudo</label>
          <input type="text" value={newHandle} onChange={e => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} />

          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 font-mono">Bio / Description</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} placeholder="Parle de toi en quelques mots..." />

          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 font-mono">Ton rôle</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent mb-4" style={{color: 'var(--text-main)'}}>
            <option value="createur">Créateur / Artiste</option>
            <option value="freelance">Freelance</option>
            <option value="entreprise">Entreprise / Agence</option>
            <option value="etudiant">Étudiant</option>
          </select>

          <label className="flex items-center gap-3 mb-6 cursor-pointer bg-[#F0F6FC] p-3 rounded-xl border border-[#C9D8E8]">
            <input type="checkbox" checked={openToCollab} onChange={e => setOpenToCollab(e.target.checked)} className="w-4 h-4 accent-[#4A90C2]" />
            <span className="text-sm font-bold text-[#2D6A9E]">🤝 Ouvert aux collaborations / partenariats</span>
          </label>

          <button onClick={saveProfile} disabled={saving} className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
          </button>
          {msg && <p className="text-center font-bold mt-3" style={{color: msg.includes('✅') ? '#7A9B5A' : '#C44A2E'}}>{msg}</p>}
        </div>

        <div className="bg-[#FDF8F0] p-6 rounded-2xl border border-[#EFE0CA]">
          <h2 className="text-lg font-bold mb-2" style={{color: '#A88620'}}>🔑 Clé cryptographique</h2>
          <p className="text-sm text-[#7A5A3A] mb-3">C'est l'empreinte de ton identité souveraine sur SCEAU. Garde-la secrète.</p>
          <div className="bg-white p-3 rounded-xl border border-[#EFE0CA] overflow-x-auto">
            <code className="text-xs font-mono text-gray-600 whitespace-nowrap">{pubkey}</code>
          </div>
        </div>

        <div className="bg-[#FDF4F0] p-6 rounded-2xl border border-[#D64545]">
          <h2 className="text-lg font-bold mb-2 text-[#A02E2E]">⚠️ Zone sensible</h2>
          <p className="text-sm text-[#A02E2E] mb-4">Déconnecte-toi de cet appareil. Ton compte restera intact.</p>
          <button onClick={logout} className="w-full border-2 border-[#D64545] text-[#D64545] py-3 rounded-xl font-bold hover:bg-[#D64545] hover:text-white transition">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
