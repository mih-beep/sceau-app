'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Seal() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Art');
  const [isHosted, setIsHosted] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSeal() {
    if (!file || !title) { setStatus("❌ Fichier et titre obligatoires."); return; }
    setLoading(true); setStatus("Calcul de l'empreinte...");

    try {
      const buffer = await file.arrayBuffer();
      const hash = sha256(new Uint8Array(buffer));
      let hashStr = ''; 
      for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
      const hashB64 = btoa(hashStr);

      const pubkey = localStorage.getItem('sceau_pubkey');
      if (!pubkey) { setStatus("❌ Tu dois créer un compte d'abord."); setLoading(false); return; }

      setStatus("Envoi au protocole...");
      const res = await fetch('/api/seal', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ hash: hashB64, title, description, pubkey, category, isHosted, isPublic }) 
      });

      const data = await res.json();
      
      if (res.ok) {
        setStatus(`✅ Succès ! Sceau ID : ${data.seal_id.slice(0, 8)}`);
        setTitle(''); setDescription(''); setFile(null);
      } else {
        setStatus(`❌ Erreur : ${data.error}`);
      }
    } catch (e) {
      setStatus("❌ Erreur système lors du scellement.");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#F5E9D8] text-[#2C1810] p-6 font-serif flex items-center justify-center">
      <div className="max-w-xl w-full bg-[#FFFCF7] p-8 rounded-3xl border-2 border-[#E8D5B8] shadow-xl">
        <h1 className="text-4xl font-black mb-2">Gravez votre œuvre.</h1>
        <p className="text-[#7A5A3A] mb-8 italic">Choisissez comment la protéger pour l'éternité.</p>

        <div className="space-y-5">
          <div>
            <label className="block font-mono text-xs font-bold text-[#A89070] uppercase mb-1">Titre de l'œuvre</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 bg-white border border-[#EFE0CA] rounded-xl focus:outline-none focus:border-[#E76F51]" placeholder="Ex: Ma chanson secrète" />
          </div>
          <div>
            <label className="block font-mono text-xs font-bold text-[#A89070] uppercase mb-1">Description (Optionnel)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-white border border-[#EFE0CA] rounded-xl focus:outline-none focus:border-[#E76F51] h-20 resize-none" placeholder="Quelques mots sur cette création..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs font-bold text-[#A89070] uppercase mb-1">Catégorie</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-white border border-[#EFE0CA] rounded-xl font-sans">
                <option>Art</option><option>Musique</option><option>Code</option><option>Écrit</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs font-bold text-[#A89070] uppercase mb-1">Fichier</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm mt-2" />
            </div>
          </div>
          <div className="bg-[#FDF8F0] p-4 rounded-xl border border-[#EFE0CA] space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isHosted} onChange={e => setIsHosted(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold">Héberger le fichier (Stocké sur SCEAU, 1 Go gratuit)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold">Rendre public (Visible sur le Feed)</span>
            </label>
          </div>
          <button onClick={handleSeal} disabled={loading} className="w-full bg-[#E76F51] text-white font-black py-4 rounded-xl hover:bg-[#F4A261] transition disabled:opacity-50 mt-4">
            {loading ? 'Scellement en cours...' : 'SCELLER MON ŒUVRE'}
          </button>
          {status && <p className="text-center font-bold mt-4 bg-white p-2 rounded-lg">{status}</p>}
        </div>
      </div>
    </main>
  );
}
