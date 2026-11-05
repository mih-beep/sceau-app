'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { generateCertificate } from '@/lib/pdf';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/feed').then(res => res.json()).then(data => {
      setSeals(data.seals || []);
      setLoading(false);
    });
  }, []);

  const downloadPdf = () => {
    if (!selectedSeal || !qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    const qrUrl = canvas ? canvas.toDataURL() : '';
    generateCertificate(selectedSeal.title, selectedSeal.author, selectedSeal.timestamp, selectedSeal.hash, qrUrl);
  };

  return (
    <main className="min-h-screen p-6 font-serif max-w-3xl mx-auto">
      <h1 className="text-4xl font-black mb-8" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51] italic">.</span></h1>
      
      {loading ? (
         <p className="text-center font-mono text-[var(--text-muted)] py-10">Chargement du réseau...</p>
      ) : seals.length === 0 ? (
        <div className="text-center bg-[var(--bg-surface)] border border-[var(--border-color)] p-10 rounded-3xl mt-10 shadow-sm">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Le réseau attend sa première œuvre.</h2>
          <p className="text-[var(--text-muted)] mb-6 italic">Personne n'a encore publié de création.</p>
          <Link href="/seal" className="inline-block bg-[#E76F51] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-[#F4A261] transition">
            Sceller ma première œuvre
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {seals.map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</h2>
                {seal.is_hosted && <span className="text-xs font-mono bg-[#F5F9EE] text-[#5D7A3A] px-2 py-1 rounded">📁 Hébergé</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">
                Par <Link href={`/u/${seal.author}`} onClick={e => e.stopPropagation()} className="font-bold text-[#E76F51] hover:underline">@{seal.author}</Link> • {new Date(seal.timestamp).toLocaleDateString('fr-FR')}
              </p>
              {seal.description && <p className="text-sm italic mb-4 opacity-80" style={{color: 'var(--text-main)'}}>"{seal.description}"</p>}
            </div>
          ))}
        </div>
      )}

      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-3xl p-8 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedSeal(null)} className="absolute top-4 right-4 text-2xl opacity-50">✕</button>
            
            <h2 className="text-3xl font-bold mb-2" style={{color: 'var(--text-main)'}}>{selectedSeal.title}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Par @{selectedSeal.author}</p>
            
            <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6">
              <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">Empreinte SHA-256</p>
              <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{selectedSeal.hash}</p>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              {selectedSeal.is_hosted && (
                <a href={selectedSeal.file_path} target="_blank" className="w-full text-center bg-[#E76F51] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#F4A261] transition">
                  📂 Ouvrir l'œuvre originale
                </a>
              )}
              <button onClick={downloadPdf} className="w-full border-2 border-[var(--border-color)] py-3 rounded-xl font-bold opacity-80 hover:opacity-100 transition" style={{color: 'var(--text-main)'}}>
                📄 Télécharger le Certificat PDF
              </button>
            </div>

            <div ref={qrRef} className="hidden">
              <QRCodeCanvas value={`https://sceau-app.vercel.app/verify?hash=${encodeURIComponent(selectedSeal.hash)}`} size={256} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
