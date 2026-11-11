'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadKeys = async () => {
    if (!pubkey) return;
    const res = await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey)}`);
    const d = await res.json();
    setKeys(d.keys || []);
    setLoading(false);
  };

  useEffect(() => { loadKeys(); }, [pubkey]);

  async function createKey() {
    if (!newKeyName.trim() || !pubkey) return;
    const res = await fetch('/api/auth/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, name: newKeyName })
    });
    const d = await res.json();
    if (res.ok) {
      setGeneratedKey(d.key);
      setNewKeyName('');
      loadKeys();
    } else alert(d.error);
  }

  async function revokeKey(id: string) {
    if (!confirm('Révoquer cette clé ? Les extensions qui l\'utilisent cesseront de fonctionner.')) return;
    await fetch(`/api/auth/api-keys?pubkey=${encodeURIComponent(pubkey!)}&id=${id}`, { method: 'DELETE' });
    loadKeys();
  }

  return (
    <div className="p-6 pb-32 max-w-2xl mx-auto font-sans w-full min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/settings" className="text-2xl opacity-50 hover:opacity-100">←</Link>
        <h1 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>Clés API</h1>
      </div>

      <div className="bg-[#F0F6FC] p-6 rounded-2xl border border-[#C9D8E8] mb-8">
        <h2 className="text-lg font-bold text-[#2D6A9E] mb-2">🔌 Connecter une application</h2>
        <p className="text-sm text-[#2D6A9E] mb-4">Générez une clé secrète pour connecter l'extension Chrome, WordPress, ou vos propres scripts.</p>
        
        {generatedKey && (
          <div className="bg-[#FFFCF7] border border-[#E9C46A] p-4 rounded-xl mb-4">
            <p className="text-xs font-bold text-[#A88620] mb-1">⚠️ Copiez cette clé maintenant, elle ne sera plus jamais affichée :</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-white p-2 rounded text-xs break-all border">{generatedKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(generatedKey); alert('Copié !'); }} className="bg-[#E9C46A] text-white px-3 rounded font-bold text-xs">Copier</button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nom (ex: Extension Chrome)" 
            className="flex-1 border-2 border-[#C9D8E8] p-2 rounded-xl bg-white text-sm outline-none focus:border-[#4A90C2]" 
            value={newKeyName} 
            onChange={e => setNewKeyName(e.target.value)} 
          />
          <button onClick={createKey} className="bg-[#4A90C2] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md">Générer</button>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4" style={{color: 'var(--text-main)'}}>Mes clés actives</h2>
      <div className="space-y-2">
        {loading ? <p className="text-center font-mono">Chargement...</p> : keys.length === 0 ? <p className="text-sm italic text-[var(--text-muted)]">Aucune clé pour le moment.</p> : (
          keys.map(k => (
            <div key={k.id} className="flex justify-between items-center bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl shadow-sm">
              <div>
                <p className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{k.name}</p>
                <p className="text-[0.65rem] text-[var(--text-muted)] font-mono">
                  {k.last_used_at ? `Utilisée le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}` : 'Jamais utilisée'}
                </p>
              </div>
              <button onClick={() => revokeKey(k.id)} className="text-red-400 hover:text-red-600 text-sm font-bold">Révoquer</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
