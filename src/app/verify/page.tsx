'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Verify() {
  const [tab, setTab] = useState('file');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function verifyFile(file: File) {
    setLoading(true);
    const buffer = await file.arrayBuffer();
    const hash = sha256(new Uint8Array(buffer));
    let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: btoa(hashStr) }) });
    const data = await res.json(); setResult(data); setLoading(false);
  }

  async function verifyHash(input: string) {
    if(!input) return; setLoading(true);
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: input }) });
    const data = await res.json(); setResult(data); setLoading(false);
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold font-serif mb-2 text-center">Vérifier.</h1>
      <p className="text-[#7A5A3A] italic font-serif mb-6 text-center">Prouvez l'authenticité.</p>
      <div className="flex bg-[#F9EEDC] p-1 rounded-xl mb-6">
        <button onClick={()=>{setTab('file');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='file'?'bg-white shadow text-[#2C1810]':'text-[#A89070]'}`}>À partir du fichier</button>
        <button onClick={()=>{setTab('hash');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='hash'?'bg-white shadow text-[#2C1810]':'text-[#A89070]'}`}>À partir du Hash</button>
      </div>
      {tab === 'file' ? (
        <div className="border-2 border-dashed border-[#4A90C2] bg-[#F0F6FC] p-8 rounded-xl text-center"><input type="file" onChange={e=>e.target.files?.[0] && verifyFile(e.target.files[0])} className="w-full text-sm" /></div>
      ) : (
        <div className="space-y-4">
          <input type="text" placeholder="Collez le hash (ex: b2e7...)" className="w-full border-2 border-[#EFE0CA] p-3 rounded-xl outline-none font-mono" onChange={e=>verifyHash(e.target.value)} />
        </div>
      )}
      {loading && <p className="text-center mt-4">Recherche...</p>}
      {result && (
        <div className={`mt-6 p-6 rounded-2xl border-2 ${result.found ? 'bg-[#F5F9EE] border-[#7A9B5A]' : 'bg-[#FDF4F0] border-[#D64545]'}`}>
          {result.found ? (
            <div className="text-center">
              <div className="text-3xl mb-2">✅</div>
              <h2 className="font-bold text-lg mb-1">FICHIER AUTHENTIQUE</h2>
              <p className="text-sm mb-2">{result.seal.title} par @{result.seal.author}</p>
              {result.seal.is_hosted && <a href={result.seal.file_path} target="_blank" className="inline-block bg-[#4A90C2] text-white px-4 py-2 rounded-lg mt-2 text-xs font-bold">⬇️ Télécharger l'œuvre</a>}
            </div>
          ) : <p className="text-center font-bold">❌ Fichier inconnu.</p>}
        </div>
      )}
    </div>
  );
}
