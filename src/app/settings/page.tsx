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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [identityCount, setIdentityCount] = useState(0);
  const [pubkey, setPubkey] = useState('');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

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

  async function loadApiKeys() {
    if (!pubkey) return;
    const res = await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey)}`);
    if (res.ok) { const d = await res.json(); setApiKeys(d.keys || []); }
  }

  useEffect(() => { if (pubkey) loadApiKeys(); }, [pubkey]);

  async function generateApiKey() {
    if (!newKeyName.trim()) return alert("Donne un nom à ta clé");
    const res = await fetch('/api/auth/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey, name: newKeyName }) });
    const data = await res.json();
    if (res.ok) { setGeneratedKey(data.key); setNewKeyName(''); loadApiKeys(); }
    else alert('Erreur: ' + data.error);
  }

  async function revokeApiKey(id: string) {
    if (!confirm('Révoquer cette clé ?')) return;
    await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey)}&id=${id}`, { method: 'DELETE' });
    loadApiKeys();
  }

  function logout() { localStorage.clear(); router.push('/login'); }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-2xl md:max-w-4xl mx-auto font-sans w-full">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profil" className="text-2xl opacity-50 hover:opacity-100 transition">←</Link>
        <h1 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>Paramètres.</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{color: 'var(--text-main)'}}>👤 Identité publique</h2>
          <input type="text" value={newHandle} onChange={e => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className="w-full border p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} />
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full border p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} placeholder="Bio..." />
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full border p-3 rounded-xl bg-transparent mb-4" style={{color: 'var(--text-main)'}}>
            <option value="createur">Créateur</option>
            <option value="freelance">Freelance</option>
          </select>
          <button onClick={saveProfile} disabled={saving} className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          {msg && <p className="text-center font-bold mt-3">{msg}</p>}
        </div>

        <div className="bg-[#FDF8F0] p-6 rounded-2xl border border-[#EFE0CA]">
          <h2 className="text-lg font-bold mb-2 text-[#A88620]">🔑 Clé cryptographique</h2>
          <code className="text-xs font-mono block p-2 bg-white rounded border break-all">{pubkey}</code>
        </div>

        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8]">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🔌 Clés API</h2>
          {generatedKey && (
            <div className="bg-[#FFFCF7] border p-3 rounded mb-3">
              <code className="text-xs break-all block mb-2">{generatedKey}</code>
              <button onClick={() => navigator.clipboard.writeText(generatedKey)} className="bg-[#E9C46A] text-white px-2 py-1 rounded text-xs">Copier</button>
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" placeholder="Nom (ex: Chrome)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="flex-1 border p-2 rounded-xl" />
            <button onClick={generateApiKey} className="bg-[#4A90C2] text-white px-4 rounded-xl font-bold">Générer</button>
          </div>
          <div className="mt-4 space-y-2">
            {apiKeys.map(k => (
              <div key={k.id} className="flex justify-between items-center bg-white p-2 rounded text-xs border">
                <span>{k.name}</span>
                <button onClick={() => revokeApiKey(k.id)} className="text-red-500 font-bold">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#FDF0F0] p-6 rounded-2xl border border-[#D64545]">
          <button onClick={logout} className="w-full border-2 border-[#D64545] text-[#D64545] py-2 rounded-xl font-bold">Se déconnecter</button>
        </div>
      </div>
    </div>
  );
}
