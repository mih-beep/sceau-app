'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Seal() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [hashAffiche, setHashAffiche] = useState('');

  async function handleSeal() {
    if (!file) { setStatus("Choisis un fichier"); return; }
    if (!title) { setStatus("N'oublie pas le titre !"); return; }
    
    setStatus("Calcul...");
    try {
      // 1. Calculer le hash
      const buffer = await file.arrayBuffer();
      const hash = sha256(new Uint8Array(buffer));
      
      let hashStr = '';
      for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
      const hashB64 = btoa(hashStr);
      
      // ON AFFICHE LE HASH ICI
      setHashAffiche(hashB64);

      const pubkey = localStorage.getItem('sceau_pubkey');
      if (!pubkey) { setStatus("Connecte-toi d'abord"); return; }

      setStatus("Envoi au protocole...");
      const res = await fetch('/api/seal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hashB64, title, pubkey }),
      });
      const data = await res.json();
      
      if (res.ok) setStatus("Succès ! ID : " + data.seal_id.slice(0, 8));
      else setStatus("Erreur : " + data.error);
    } catch (e) { setStatus("Erreur système"); }
  }

  return (
    <main className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-black">Sceller un fichier</h1>
      
      <input 
        type="text" 
        placeholder="Titre de l'œuvre" 
        className="border p-2 w-full mb-4 rounded text-black" 
        value={title} 
        onChange={(e) => setTitle(e.target.value)} 
      />
      
      <input 
        type="file" 
        className="mb-4 block w-full text-sm text-gray-500" 
        onChange={(e) => setFile(e.target.files?.[0] || null)} 
      />
      
      <button 
        onClick={handleSeal} 
        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded w-full font-bold"
      >
        Sceller mon fichier
      </button>

      {/* AFFICHAGE DU HASH */}
      {hashAffiche && (
        <div className="mt-6 p-4 bg-gray-100 rounded border border-gray-300">
          <p className="text-xs font-bold text-gray-500 mb-1">Empreinte SHA-256 (Hash) :</p>
          <p className="text-xs font-mono break-all text-black">{hashAffiche}</p>
        </div>
      )}

      <p className="mt-4 font-bold text-center text-black text-lg">{status}</p>
    </main>
  );
}
