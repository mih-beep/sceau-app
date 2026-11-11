'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [pubkey, setPubkey] = useState('');
  const [oldHandle, setOldHandle] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState('createur');
  const [openToCollab, setOpenToCollab] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [identityCount, setIdentityCount] = useState(0);

  useEffect(() => {
    const h = localStorage.getItem('sceau_handle');
    const p = localStorage.getItem('sceau_pubkey');
    if (!h || !p) { router.push('/login'); return; }
    setOldHandle(h); setNewHandle(h); setPubkey(p);

    fetch(`/api/profil?pubkey=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(d => {
        if (d.handle) {
          setBio(d.bio || ''); setRole(d.role || 'createur');
          setOpenToCollab(d.open_to_collaboration === true);
          setFirstName(d.first_name || ''); setLastName(d.last_name || '');
          setBirthDate(d.birth_date ? d.birth_date.split('T')[0] : '');
          setIdentityCount(d.identity_changes_count || 0);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [router]);

  async function saveProfile() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/profil/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, old_handle: oldHandle, new_handle: newHandle, bio, role, open_to_collaboration: openToCollab, first_name: firstName, last_name: lastName, birth_date: birthDate }),
    });
    const data = await res.json();
    if (res.ok) { setMsg('✅ Profil mis à jour !'); localStorage.setItem('sceau_handle', data.new_handle); setOldHandle(data.new_handle); }
    else setMsg('❌ ' + data.error);
    setSaving(false);
  }

  function logout() {
    if(confirm("Se déconnecter ?")) { localStorage.clear(); router.push('/login'); }
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-2xl md:max-w-4xl mx-auto font-sans w-full">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profil" className="text-2xl opacity-50 hover:opacity-100 transition">←</Link>
        <h1 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>Paramètres.</h1>
      </div>

      <div className="space-y-6">
        {/* Identité Publique */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{color: 'var(--text-main)'}}>👤 Identité publique</h2>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 font-mono">Pseudo</label>
          <input type="text" value={newHandle} onChange={e => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className="w-full border p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} />
          
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 font-mono">Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full border p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} />
          
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 font-mono">Rôle</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full border p-3 rounded-xl bg-transparent mb-4" style={{color: 'var(--text-main)'}}>
            <option value="createur">Créateur / Artiste</option>
            <option value="freelance">Freelance</option>
            <option value="entreprise">Entreprise / Agence</option>
            <option value="etudiant">Étudiant</option>
          </select>
          <button onClick={saveProfile} disabled={saving} className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
          </button>
          {msg && <p className="text-center font-bold mt-3" style={{color: msg.includes('✅') ? '#7A9B5A' : '#C44A2E'}}>{msg}</p>}
        </div>

        {/* Identité de confiance */}
        <div className={`p-6 rounded-2xl border ${identityCount >= 3 ? 'bg-red-50 border-red-200' : 'bg-[#F0F6FC] border-[#C9D8E8]'}`}>
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🛡️ Identité de confiance (Privée)</h2>
          <p className="text-xs mb-4 italic text-[#2D6A9E]">3 modifications maximum.</p>
          <div className="flex gap-4 mb-4">
            <div className="flex-1"><input type="text" disabled={identityCount >= 3} placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border p-3 rounded-xl disabled:opacity-50" /></div>
            <div className="flex-1"><input type="text" disabled={identityCount >= 3} placeholder="Nom" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border p-3 rounded-xl disabled:opacity-50" /></div>
          </div>
          <input type="date" disabled={identityCount >= 3} value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full border p-3 rounded-xl disabled:opacity-50" />
        </div>

        {/* Clé API */}
        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8]">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🔌 API & Intégrations</h2>
          <p className="text-xs text-[#2D6A9E] mb-4">Connectez SCEAU à vos outils.</p>
          <Link href="/settings/keys" className="inline-block bg-[#4A90C2] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">Gérer mes clés API</Link>
        </div>

        {/* Légal */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{color: 'var(--text-main)'}}>⚖️ Cadre Légal</h2>
          <Link href="/legal" className="text-sm font-bold text-[#4A90C2] hover:underline block mb-2">Conditions Générales d'Utilisation</Link>
          <Link href="/legal" className="text-sm font-bold text-[#4A90C2] hover:underline block">Politique de Confidentialité</Link>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#FDF0F0] p-6 rounded-2xl border border-[#D64545]">
          <h2 className="text-lg font-bold mb-2 text-[#A02E2E]">⚠️ Zone sensible</h2>
          <button onClick={logout} className="w-full border-2 border-[#D64545] text-[#D64545] py-2 rounded-xl font-bold hover:bg-[#D64545] hover:text-white transition">Se déconnecter</button>
        </div>
      </div>
    </div>
  );
}
