'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Verify() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const buffer = await file.arrayBuffer();
    const hash = sha256(new Uint8Array(buffer));
    let hashStr = '';
    for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
    
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: btoa(hashStr) }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <main className="p-10 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-black">Vérifier un fichier</h1>
        <a href="/feed" className="text-blue-600 underline">Voir le feed</a>
      </div>

      <input 
        type="file" 
        className="mb-4 block w-full text-sm text-gray-500" 
        onChange={(e) => setFile(e.target.files?.[0] || null)} 
      />
      <button 
        onClick={handleVerify} 
        disabled={loading}
        className="bg-blue-600 text-white p-2 rounded w-full font-bold"
      >
        {loading ? "Vérification..." : "Vérifier l'authenticité"}
      </button>

      {result && (
        <div className={`mt-6 p-4 rounded border ${result.found ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
          {result.found ? (
            <div>
              <p className="font-bold text-green-700">✅ Fichier authentique !</p>
              <p className="text-black mt-2">Titre : {result.seal.title}</p>
              <p className="text-black">Auteur : @{result.seal.author}</p>
              <p className="text-black">Scellé le : {new Date(result.seal.timestamp).toLocaleString('fr-FR')}</p>
            </div>
          ) : (
            <p className="font-bold text-red-700">❌ Fichier inconnu. Il n'a jamais été scellé sur SCEAU.</p>
          )}
        </div>
      )}
    </main>
  );
}
