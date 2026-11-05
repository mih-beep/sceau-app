'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Seal() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Art');
  const [isHosted, setIsHosted] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [status, setStatus] = useState('');

  async function handleSeal() {
    if (!file || !title) return setStatus("Fichier et titre requis");
    setStatus("Calcul de l'empreinte...");
    
    try {
      // 1. Calcul du hash
      const buffer = await file.arrayBuffer();
      const hash = sha256(new Uint8Array(buffer));
      let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
      const hashB64 = btoa(hashStr);
      
      const pubkey = localStorage.getItem('sceau_pubkey');
      if (!pubkey) return setStatus("Créez un compte d'abord !");

      setStatus("Ancrage dans le réseau Bitcoin (OpenTimestamps)...");

      // 2. Envoi au serveur
      const formData = new FormData();
      formData.append('hash', hashB64);
      formData.append('title', title);
      formData.append('description', desc);
      formData.append('category', cat);
      formData.append('isHosted', isHosted.toString());
      formData.append('isPublic', isPublic.toString());
      formData.append('pubkey', pubkey);
      formData.append('file', file);

      const res = await fetch('/api/seal', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (res.ok) {
        setStatus("✅ Scellé ! Preuve OpenTimestamps générée.");
        setTitle(''); setDesc(''); setFile(null);
      } else {
        setStatus("❌ Erreur : " + data.error);
      }
    } catch (e) { 
      setStatus("❌ Erreur système"); 
    }
  }

  return (
    <div className="p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold font-serif">Gravez votre œuvre.</h1>
        <p className="text-[#7A5A3A] italic font-serif">100% gratuit, ancré dans le temps.</p>
      </div>
      <div className="space-y-4 max-w-md mx-auto bg-white p-6 rounded-2xl border border-[#EFE0CA] shadow-sm">
        <div><label className="text-xs font-mono font-bold text-[#A89070] uppercase">Titre</label><input type="text" className="w-full border-2 border-[#EFE0CA] focus:border-[#E76F51] rounded-xl p-3 outline-none" value={title} onChange={e=>setTitle(e.target.value)} /></div>
        <div><label className="text-xs font-mono font-bold text-[#A89070] uppercase">Description</label><textarea className="w-full border-2 border-[#EFE0CA] focus:border-[#E76F51] rounded-xl p-3 outline-none" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} /></div>
        
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-mono font-bold text-[#A89070] uppercase">Catégorie</label><select className="w-full border-2 border-[#EFE0CA] rounded-xl p-3 outline-none" value={cat} onChange={e=>setCat(e.target.value)}><option>Art</option><option>Musique</option><option>Code</option><option>Écrit</option></select></div>
          <div><label className="text-xs font-mono font-bold text-[#A89070] uppercase">Fichier</label><input type="file" className="w-full text-sm mt-2" onChange={e=>setFile(e.target.files?.[0]||null)} /></div>
        </div>

        <div className="bg-[#FDF8F0] p-4 rounded-xl border border-[#EFE0CA] space-y-2">
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={isHosted} onChange={e=>setIsHosted(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" /><span className="text-sm font-bold">Héberger le fichier</span></label>
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" /><span className="text-sm font-bold">Rendre public (Feed)</span></label>
        </div>
        
        <button onClick={handleSeal} className="w-full bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white p-4 rounded-xl font-bold shadow-lg">SCELLER</button>
        {status && <p className="text-center font-bold mt-4 text-[#C44A2E]">{status}</p>}
      </div>
    </div>
  );
}
