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
    <div className="p-6 max-w-2xl mx-auto font-serif">
      <h1 className="text-3xl font-bold mb-2 text-center" style={{color: 'var(--text-main)'}}>Vérifier.</h1>
      <p className="text-[var(--text-muted)] italic mb-6 text-center">Prouvez l'authenticité.</p>
      
      <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl mb-6">
        <button onClick={()=>{setTab('file');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='file'?'bg-[var(--bg-main)] shadow':'opacity-50'}`} style={{color: 'var(--text-main)'}}>À partir du fichier</button>
        <button onClick={()=>{setTab('hash');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='hash'?'bg-[var(--bg-main)] shadow':'opacity-50'}`} style={{color: 'var(--text-main)'}}>À partir du Hash</button>
      </div>

      {tab === 'file' ? (
        <div className="border-2 border-dashed border-[#4A90C2] bg-[var(--bg-surface)] p-8 rounded-xl text-center">
          <input type="file" onChange={e=>e.target.files?.[0] && verifyFile(e.target.files[0])} className="w-full text-sm" style={{color: 'var(--text-main)'}} />
        </div>
      ) : (
        <div className="space-y-4">
          <input type="text" placeholder="Collez le hash (ex: b2e7...)" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl outline-none font-mono bg-transparent" style={{color: 'var(--text-main)'}} onChange={e=>verifyHash(e.target.value)} />
        </div>
      )}

      {loading && <p className="text-center mt-4 font-mono">Recherche...</p>}
      
      {result && (
        <div className={`mt-8 p-6 rounded-2xl border-2 ${result.found ? 'bg-[var(--bg-surface)] border-[#7A9B5A]' : 'bg-[#FDF4F0] border-[#D64545]'}`}>
          {result.found ? (
            <div>
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">✅</div>
                <h2 className="font-bold text-xl" style={{color: 'var(--text-main)'}}>FICHIER AUTHENTIQUE</h2>
                <p className="text-sm text-[var(--text-muted)]">{result.seals.length} preuve(s) trouvée(s)</p>
              </div>
              
              <div className="space-y-4">
                {result.seals.map((seal: any, index: number) => (
                  <div key={index} className={`p-4 rounded-xl border ${index === 0 ? 'border-[#E76F51] bg-[var(--bg-main)]' : 'border-[var(--border-color)]'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Scellé par <span className="font-bold text-[#E76F51]">@{seal.author}</span> le {new Date(seal.timestamp).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      {index === 0 && <span className="text-[0.6rem] font-mono bg-[#FCEAD6] text-[#C44A2E] px-2 py-1 rounded">PREMIER</span>}
                    </div>
                    {seal.is_hosted && (
                      <a href={seal.file_path} target="_blank" className="mt-3 inline-block bg-[#4A90C2] text-white px-4 py-2 rounded-lg text-xs font-bold">⬇️ Télécharger l'œuvre</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center font-bold text-[#A02E2E]">❌ Fichier inconnu. Il n'est pas dans le registre SCEAU.</p>
          )}
        </div>
      )}
    </div>
  );
}
