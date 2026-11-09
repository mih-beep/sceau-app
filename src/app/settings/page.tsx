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
  const [pubkey, setPubkey] = useState('');
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

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
          setFirstName(d.first_name || '');
          setLastName(d.last_name || '');
          setBirthDate(d.birth_date ? d.birth_date.split('T')[0] : '');
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
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
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

  async function loadApiKeys() {
    if (!pubkey) return;
    const res = await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey)}`);
    if (res.ok) {
      const d = await res.json();
      setApiKeys(d.keys || []);
    }
  }

  useEffect(() => {
    if (pubkey) loadApiKeys();
  }, [pubkey]);

  async function generateApiKey() {
    if (!newKeyName.trim()) return alert("Donne un nom à ta clé (ex: WordPress, GitHub)");
    setIsGeneratingKey(true);
    const res = await fetch('/api/auth/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, name: newKeyName })
    });
    const data = await res.json();
    if (res.ok) {
      setGeneratedKey(data.key);
      setNewKeyName('');
      loadApiKeys();
    } else {
      alert('Erreur: ' + data.error);
    }
    setIsGeneratingKey(false);
  }

  function logout() {
    localStorage.clear();
    router.push('/login');
  }

  if (loading) return <div className="p-10 text-center font-mono">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl md:max-w-4xl mx-auto font-sans w-full">
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

        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8]">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🛡️ Identité de confiance (Privée)</h2>
          <p className="text-xs text-[#2D6A9E] mb-4 italic">Ces informations ne sont jamais visibles sur votre profil. Elles servent uniquement à prouver que ce compte vous appartient en cas de litige.</p>
          
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Prénom</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Nom</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none" />
            </div>
          </div>
          
          <label className="block text-xs font-bold text-[#2D6A9E] mb-1 font-mono">Date de naissance</label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full border-2 border-[#C9D8E8] p-3 rounded-xl bg-white focus:border-[#4A90C2] outline-none" />
        </div>

        <div className="bg-[#FDF8F0] p-6 rounded-2xl border border-[#EFE0CA]">
          <h2 className="text-lg font-bold mb-2" style={{color: '#A88620'}}>🔑 Clé cryptographique</h2>
          <p className="text-sm text-[#7A5A3A] mb-3">C'est l'empreinte de ton identité souveraine sur SCEAU. Garde-la secrète.</p>
          <div className="bg-white p-3 rounded-xl border border-[#EFE0CA] overflow-x-auto">
            <code className="text-xs font-mono text-gray-600 whitespace-nowrap">{pubkey}</code>
          </div>
        </div>

        <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8]">
          <h2 className="text-lg font-bold mb-2 text-[#2D6A9E]">🔌 Clés API (Développeurs & Plugins)</h2>
          <p className="text-xs text-[#2D6A9E] mb-4 italic">Générez une clé pour connecter SCEAU à votre site WordPress, GitHub ou une application externe.</p>

          {generatedKey && (
            <div className="bg-[#FFFCF7] border border-[#E9C46A] p-4 rounded-xl mb-4">
              <p className="text-xs font-bold text-[#A88620] mb-1">⚠️ Copiez cette clé maintenant, elle ne sera plus jamais affichée :</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-[var(--bg-main)] p-2 rounded text-xs break-all border border-[var(--border-color)]">{generatedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(generatedKey); alert('Copié !'); }} className="bg-[#E9C46A] text-white px-3 rounded font-bold text-xs">Copier</button>
              </div>
              <button onClick={() => setGeneratedKey(null)} className="text-xs text-[#A88620] font-bold mt-2 underline">J'ai copié la clé, la fermer.</button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Nom (ex: Mon site WordPress)" 
              className="flex-1 border-2 border-[#C9D8E8] p-2 rounded-xl bg-white focus:border-[#4A90C2] outline-none text-sm" 
              value={newKeyName} 
              onChange={e => setNewKeyName(e.target.value)} 
            />
            <button 
              onClick={generateApiKey} 
              disabled={isGeneratingKey}
              className="bg-[#4A90C2] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md disabled:opacity-50"
            >
              {isGeneratingKey ? '...' : 'Générer'}
            </button>
          </div>

          {apiKeys.length > 0 && (
            <div className="space-y-2 mt-4 border-t border-[#C9D8E8] pt-4">
              <p className="text-xs font-bold text-[#2D6A9E] mb-2">Vos clés actives :</p>
              {apiKeys.map(k => (
                <div key={k.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#C9D8E8] text-xs">
                  <span className="font-bold">{k.name}</span>
                  <span className="text-[#8A7A72]">
                    {k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-[#C9D8E8]">
            <h3 className="text-sm font-bold text-[#2D6A9E] mb-3">📦 Télécharger les Plugins (SCEAU Pro)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/downloads/sceau-wordpress.zip" download className="flex items-center justify-center gap-2 bg-[#2D6A9E] text-white py-2 rounded-lg font-bold text-sm shadow hover:bg-[#1E507A] transition">
                <span>🔌</span> Plugin WordPress
              </a>
              <a href="/downloads/sceau-github-action.yml" download className="flex items-center justify-center gap-2 bg-[#2C1810] text-white py-2 rounded-lg font-bold text-sm shadow hover:bg-black transition">
                <span>🐙</span> GitHub Action (YML)
              </a>
            </div>
            <p className="text-[0.65rem] text-[#2D6A9E] mt-2 italic text-center">Installez le plugin et collez-y votre clé API.</p>
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
