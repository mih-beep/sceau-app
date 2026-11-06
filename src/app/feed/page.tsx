'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { generateCertificate } from '@/lib/pdf';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  
  const qrRef = useRef<HTMLDivElement>(null);
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadFeed = () => {
    fetch(`/api/feed?me=${myHandle || ''}`)
      .then(res => res.json())
      .then(data => { setSeals(data.seals || []); setLoading(false); });
  };

  useEffect(() => {
    loadFeed();
    fetch('/api/feed/trends').then(res => res.json()).then(data => setTrends(data.trends || []));
  }, [myHandle]);

  async function react(type: string) {
    if (!myPubkey || !selectedSeal) return;
    await fetch('/api/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seal_id: selectedSeal.id, pubkey: myPubkey, reaction_type: type }) });
    // Mise à jour locale optimiste
    setSelectedSeal({ ...selectedSeal, [`likes_${type === 'like' ? 'like' : type}`]: (selectedSeal[`likes_${type === 'like' ? 'like' : type}`] || 0) + 1 });
    loadFeed();
  }

  const downloadPdf = () => {
    if (!selectedSeal || !qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    generateCertificate(selectedSeal.title, selectedSeal.author, selectedSeal.timestamp, selectedSeal.hash, canvas?.toDataURL() || '');
  };

  return (
    <main className="min-h-screen p-6 font-serif max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-black" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51] italic">.</span></h1>
        <div className="flex gap-2">
          <button onClick={() => { const random = seals[Math.floor(Math.random() * seals.length)]; if(random) setSelectedSeal(random); }} className="bg-[var(--bg-surface)] border border-[var(--border-color)] px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:border-[#E76F51] transition" title="Œuvre au hasard">🎲 Aléatoire</button>
          <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-[#F4A261] transition">+ Sceller</Link>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>🌍 Le fil global</h2>
      {loading ? (
         <p className="text-center font-mono text-[var(--text-muted)] py-10">Connexion...</p>
      ) : (
        <div className="grid gap-6 mb-10">
          {seals.map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</h2>
                  {seal.is_mystery && <span className="text-xs bg-gray-800 text-white px-2 py-1 rounded">Mystère</span>}
                  {seal.version_number > 1 && <span className="text-xs font-mono font-bold bg-[#FCEAD6] text-[#C44A2E] px-2 py-1 rounded">V{seal.version_number}</span>}
                </div>
                {seal.location && <span className="text-xs font-mono bg-[#FDF8F0] border border-[var(--border-color)] px-2 py-1 rounded">📍 {seal.location}</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">Par <span className="font-bold text-[#E76F51]">@{seal.author}</span> • {new Date(seal.timestamp).toLocaleString('fr-FR')}</p>
              
              {seal.is_mystery && (
                <div className="bg-[#2C1810] text-[#F5E9D8] p-4 rounded-xl my-3 text-center">
                  <p className="text-sm italic">"{seal.description}"</p>
                  <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E76F51]" style={{ width: `${Math.min(100, ((seal.likes_like || 0) / (seal.unlock_likes || 10)) * 100)}%` }}></div>
                  </div>
                  <p className="text-xs mt-2 font-mono">{seal.likes_like || 0} / {seal.unlock_likes} J'aime pour révéler</p>
                </div>
              )}

              <div className="flex gap-4 mt-4">
                <div className="text-sm text-[var(--text-muted)]">❤️ {seal.likes_like || 0}</div>
                <div className="text-sm text-[var(--text-muted)]">🤯 {seal.likes_wow || 0}</div>
                <div className="text-sm text-[var(--text-muted)]">💡 {seal.likes_inspired || 0}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALE DE DÉTAIL */}
      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-3xl relative max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{color: 'var(--text-main)'}}>{selectedSeal.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">Par @{selectedSeal.author}</p>
              </div>
              <button onClick={() => setSelectedSeal(null)} className="text-2xl opacity-50">✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {selectedSeal.is_mystery && (
                <p className="italic text-center mb-4" style={{color: 'var(--text-main)'}}>"{selectedSeal.description}"</p>
              )}

              {selectedSeal.file_path ? (
                <div className="flex gap-2 mb-4">
                  <a href={selectedSeal.file_path} target="_blank" className="flex-1 text-center bg-[#E76F51] text-white py-3 rounded-xl font-bold shadow-md">📂 Ouvrir l'œuvre</a>
                </div>
              ) : selectedSeal.is_mystery ? (
                <div className="bg-[#FDF4F0] p-4 rounded-xl border border-[#E76F51] text-center mb-4">
                  <p className="text-sm font-bold text-[#C44A2E]">Ce fichier est masqué.</p>
                  <p className="text-xs mt-1 text-[#7A5A3A]">Atteignez {selectedSeal.unlock_likes} J'aime ou contactez l'auteur en PV.</p>
                  <Link href={`/messages`} className="mt-3 inline-block bg-[#2C1810] text-white px-4 py-2 rounded-lg text-xs font-bold">💬 Contacter l'auteur</Link>
                </div>
              ) : null}
              
              <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6 text-center">
                <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">SHA-256</p>
                <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{selectedSeal.hash}</p>
              </div>
              
              <div className="flex gap-2 mb-8">
                <button onClick={() => react('like')} className="flex-1 bg-[#FDF4F0] border border-[#F4D0A8] text-[#C44A2E] py-2 rounded-xl font-bold flex justify-center items-center gap-1 hover:bg-[#FCE0D6]">❤️ {selectedSeal.likes_like || 0}</button>
                <button onClick={() => react('wow')} className="flex-1 bg-[#F0F6FC] border border-[#C9D8E8] text-[#2D6A9E] py-2 rounded-xl font-bold flex justify-center items-center gap-1 hover:bg-[#DCE8F5]">🤯 {selectedSeal.likes_wow || 0}</button>
                <button onClick={() => react('inspired')} className="flex-1 bg-[#FDF8F0] border border-[#F0D68A] text-[#A88620] py-2 rounded-xl font-bold flex justify-center items-center gap-1 hover:bg-[#FCEAD6]">💡 {selectedSeal.likes_inspired || 0}</button>
              </div>
            </div>
            <div ref={qrRef} className="hidden"><QRCodeCanvas value={`${window.location.origin}/o/${selectedSeal.id}`} size={256} /></div>
          </div>
        </div>
      )}
    </main>
  );
}
