'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { generateCertificate } from '@/lib/pdf';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [friendsSeals, setFriendsSeals] = useState<any[]>([]);
  
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  
  const qrRef = useRef<HTMLDivElement>(null);
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;

  const loadFeed = () => {
    const params = new URLSearchParams({ time: timeFilter, loc: locationFilter });
    fetch(`/api/feed?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setSeals(data.seals || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadFeed();
    
    // Chargement des Tendances
    fetch('/api/feed/trends').then(res => res.json()).then(data => setTrends(data.trends || []));
    
    // Chargement des Amis (si connecté)
    if (myHandle) {
      fetch(`/api/feed/friends?me=${myHandle}`).then(res => res.json()).then(data => setFriendsSeals(data.friends_seals || []));
    }

    const interval = setInterval(loadFeed, 10000);
    return () => clearInterval(interval);
  }, [timeFilter, locationFilter, myHandle]);

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

      {/* SECTION TENDANCES */}
      {trends.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2" style={{color: 'var(--text-main)'}}>🔥 Tendances de la semaine</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
            {trends.map((trend, i) => (
              <div key={trend.id} onClick={() => setSelectedSeal(trend)} className="snap-start shrink-0 w-64 bg-[var(--bg-surface)] p-4 rounded-xl border-2 border-[#E76F51] shadow-sm cursor-pointer hover:shadow-md transition relative">
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-[#E76F51] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">#{i+1}</div>
                <div className="font-bold text-lg mb-1 truncate" style={{color: 'var(--text-main)'}}>{trend.title}</div>
                <div className="text-xs text-[var(--text-muted)] mb-3">@{trend.author}</div>
                <div className="text-xs font-mono bg-[#FDF8F0] px-2 py-1 rounded inline-block text-[#E76F51] border border-[#F4D0A8]">❤️ {trend.likes_count} J'aime</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION EFFET CERCLE (AMIS) */}
      {friendsSeals.length > 0 && (
        <div className="mb-8 bg-[#F0F6FC] border border-[#4A90C2] p-5 rounded-2xl">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2" style={{color: '#1E4A78'}}>👥 L'activité de ton cercle</h2>
          <div className="space-y-3">
            {friendsSeals.map(seal => (
              <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-white p-3 rounded-xl border border-[#C9D8E8] flex justify-between items-center cursor-pointer hover:shadow-sm">
                <div>
                  <span className="font-bold text-[#2D6A9E]">@{seal.author}</span> a scellé <span className="font-bold" style={{color: 'var(--text-main)'}}>"{seal.title}"</span>
                </div>
                <div className="text-xs font-mono text-[#A89070]">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIL GLOBAL (Le reste du feed) */}
      <h2 className="text-xl font-bold mb-3" style={{color: 'var(--text-main)'}}>🌍 Le fil global</h2>
      
      {/* BARRE DE FILTRES */}
      <div className="flex flex-wrap gap-2 mb-6 bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
        <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="bg-transparent text-sm font-bold outline-none cursor-pointer">
          <option value="all">🕒 Tout le temps</option>
          <option value="hour">⏱️ Dernière heure</option>
          <option value="day">📅 Aujourd'hui</option>
          <option value="week">🗓️ Cette semaine</option>
        </select>
        <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>
        <input 
          type="text" placeholder="🌍 Pays/Ville..." value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          className="bg-transparent text-sm outline-none flex-1 min-w-[100px] font-mono"
        />
      </div>
      
      {loading ? (
         <p className="text-center font-mono text-[var(--text-muted)] py-10">Connexion au registre...</p>
      ) : seals.length === 0 ? (
        <div className="text-center bg-[var(--bg-surface)] border border-[var(--border-color)] p-10 rounded-3xl shadow-sm">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Aucun sceau ne correspond.</h2>
        </div>
      ) : (
        <div className="grid gap-6 mb-10">
          {seals.map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</h2>
                {seal.location && <span className="text-xs font-mono bg-[#FDF8F0] border border-[var(--border-color)] px-2 py-1 rounded">📍 {seal.location}</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">
                Par <Link href={`/u/${seal.author}`} onClick={e => e.stopPropagation()} className="font-bold text-[#E76F51] hover:underline">@{seal.author}</Link> • {new Date(seal.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* MODALE DE DÉTAIL */}
      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-3xl p-8 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedSeal(null)} className="absolute top-4 right-4 text-2xl opacity-50">✕</button>
            <h2 className="text-3xl font-bold mb-2" style={{color: 'var(--text-main)'}}>{selectedSeal.title}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Par @{selectedSeal.author} {selectedSeal.location && `à ${selectedSeal.location}`}</p>
            
            <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6">
              <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">Empreinte SHA-256</p>
              <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{selectedSeal.hash || "Hash non disponible"}</p>
            </div>
            <div className="flex flex-col gap-3 mb-4">
              {selectedSeal.is_hosted && selectedSeal.file_path && (
                <a href={selectedSeal.file_path} target="_blank" className="w-full text-center bg-[#E76F51] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#F4A261] transition">📂 Ouvrir l'œuvre</a>
              )}
              <button onClick={downloadPdf} className="w-full border-2 border-[var(--border-color)] py-3 rounded-xl font-bold opacity-80 hover:opacity-100 transition" style={{color: 'var(--text-main)'}}>📄 Certificat PDF</button>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/o/${selectedSeal.id}`); alert('Lien de partage copié !'); }} className="w-full border-2 border-[#4A90C2] text-[#2D6A9E] py-3 rounded-xl font-bold hover:bg-[#F0F6FC] transition">🔗 Partager le lien</button>
            </div>
            <div ref={qrRef} className="hidden">
              <QRCodeCanvas value={`${window.location.origin}/verify?hash=${encodeURIComponent(selectedSeal.hash || '')}`} size={256} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
