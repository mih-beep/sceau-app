'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { generateCertificate } from '@/lib/pdf';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Nouveaux états pour les filtres
  const [timeFilter, setTimeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');

  const qrRef = useRef<HTMLDivElement>(null);

  // Fonction pour charger les données
  const loadFeed = () => {
    const params = new URLSearchParams({ time: timeFilter, loc: locationFilter });
    fetch(`/api/feed?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setSeals(data.seals || []);
        setLoading(false);
      });
  };

  // Chargement initial + Rafraîchissement automatique toutes les 10 sec
  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 10000);
    return () => clearInterval(interval);
  }, [timeFilter, locationFilter]);

  const downloadPdf = () => {
    if (!selectedSeal || !qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    const qrUrl = canvas ? canvas.toDataURL() : '';
    generateCertificate(selectedSeal.title, selectedSeal.author, selectedSeal.timestamp, selectedSeal.hash, qrUrl);
  };

  return (
    <main className="min-h-screen p-6 font-serif max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-black" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51] italic">.</span></h1>
        <div className="flex items-center gap-2 text-xs font-mono text-[#7A9B5A]">
          <span className="w-2 h-2 rounded-full bg-[#7A9B5A] animate-pulse"></span> En direct
        </div>
      </div>

      {/* BARRE DE FILTRES */}
      <div className="flex flex-wrap gap-2 mb-8 bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
        <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="bg-transparent text-sm font-bold outline-none cursor-pointer">
          <option value="all">🕒 Tout le temps</option>
          <option value="hour">⏱️ Dernière heure</option>
          <option value="day">📅 Aujourd'hui</option>
          <option value="week">🗓️ Cette semaine</option>
        </select>
        <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>
        <input 
          type="text" 
          placeholder="🌍 Filtrer par pays/ville..." 
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="bg-transparent text-sm outline-none flex-1 min-w-[150px] font-mono"
        />
      </div>
      
      {loading ? (
         <p className="text-center font-mono text-[var(--text-muted)] py-10">Connexion au registre...</p>
      ) : seals.length === 0 ? (
        <div className="text-center bg-[var(--bg-surface)] border border-[var(--border-color)] p-10 rounded-3xl shadow-sm">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Aucun sceau ne correspond à ces filtres.</h2>
          <p className="text-[var(--text-muted)] mb-6 italic">Essaie de changer la zone ou la période.</p>
        </div>
      ) : (
        <div className="grid gap-6 mb-10">
          {seals.map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group">
              {/* Ligne de temps visuelle */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E76F51] opacity-0 group-hover:opacity-100 transition"></div>
              
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</h2>
                {seal.location && <span className="text-xs font-mono bg-[#FDF8F0] border border-[var(--border-color)] px-2 py-1 rounded">📍 {seal.location}</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">
                Par <Link href={`/u/${seal.author}`} onClick={e => e.stopPropagation()} className="font-bold text-[#E76F51] hover:underline">@{seal.author}</Link> • {new Date(seal.timestamp).toLocaleString('fr-FR')}
              </p>
              {seal.description && <p className="text-sm italic mb-4 opacity-80" style={{color: 'var(--text-main)'}}>"{seal.description}"</p>}
            </div>
          ))}
        </div>
      )}

      {/* MODALE DE DÉTAIL (inchangée) */}
      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-3xl p-8 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedSeal(null)} className="absolute top-4 right-4 text-2xl opacity-50">✕</button>
            
            <h2 className="text-3xl font-bold mb-2" style={{color: 'var(--text-main)'}}>{selectedSeal.title}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Par @{selectedSeal.author} {selectedSeal.location && `à ${selectedSeal.location}`}</p>
            
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
              <QRCodeCanvas value={`${window.location.origin}/verify?hash=${encodeURIComponent(selectedSeal.hash)}`} size={256} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
