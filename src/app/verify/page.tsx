'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link'; // L'IMPORT MANQUANT EST ICI
import { sha256 } from '@noble/hashes/sha256';

export default function Verify() {
  const [tab, setTab] = useState('file');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [titleQuery, setTitleQuery] = useState('');
  
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineMode, setTimelineMode] = useState<'live' | 'period'>('live');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (tab !== 'timeline') return;
    const fetchTimeline = () => {
      setTimelineLoading(true);
      const url = timelineMode === 'live' 
        ? '/api/verify/timeline?live=true'
        : `/api/verify/timeline?start=${startDate}&end=${endDate}`;
        
      fetch(url).then(res => res.json()).then(data => {
        setTimelineData(data.timeline || []);
        setTimelineLoading(false);
      });
    };
    fetchTimeline();
    if (timelineMode === 'live') {
      const interval = setInterval(fetchTimeline, 5000);
      return () => clearInterval(interval);
    }
  }, [tab, timelineMode, startDate, endDate]);

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

  async function searchByTitle() {
    if(!titleQuery) return; setLoading(true);
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: titleQuery }) });
    const data = await res.json(); setResult(data); setLoading(false);
  }

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return "À l'instant";
    if (diff === 1) return "Il y a 1 minute";
    if (diff < 60) return `Il y a ${diff} minutes`;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-2xl md:max-w-5xl mx-auto font-sans w-full">
      <div className="flex justify-center mb-6">
        <div className="flex bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-color)]">
          <Link href="/seal" className="px-6 py-2 rounded-lg font-bold text-sm opacity-50 hover:opacity-100 transition">✍️ Sceller</Link>
          <Link href="/verify" className="px-6 py-2 rounded-lg font-bold text-sm bg-[var(--bg-surface)] shadow text-[#E76F51]">🔍 Vérifier</Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-2 text-center" style={{color: 'var(--text-main)'}}>Vérifier & Découvrir.</h1>
      <p className="text-[var(--text-muted)] italic mb-6 text-center">Prouvez l'authenticité ou découvrez le monde.</p>
      
      <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl mb-6">
        <button onClick={()=>{setTab('file');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='file'?'bg-[var(--bg-main)] shadow':'opacity-50'}`} style={{color: 'var(--text-main)'}}>Fichier</button>
        <button onClick={()=>{setTab('hash');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='hash'?'bg-[var(--bg-main)] shadow':'opacity-50'}`} style={{color: 'var(--text-main)'}}>Hash</button>
        <button onClick={()=>{setTab('title');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='title'?'bg-[var(--bg-main)] shadow':'opacity-50'}`} style={{color: 'var(--text-main)'}}>Titre</button>
        <button onClick={()=>{setTab('timeline');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='timeline'?'bg-[#E76F51] text-white shadow':'opacity-50'}`} style={{color: tab==='timeline' ? '#FFF' : 'var(--text-main)'}}>Chronologie</button>
      </div>

      {tab === 'file' && (
        <div className="border-2 border-dashed border-[#4A90C2] bg-[var(--bg-surface)] p-8 rounded-xl text-center">
          <input type="file" onChange={e=>e.target.files?.[0] && verifyFile(e.target.files[0])} className="w-full text-sm" style={{color: 'var(--text-main)'}} />
        </div>
      )}

      {tab === 'hash' && (
        <div className="space-y-4">
          <input type="text" placeholder="Collez le hash (ex: b2e7...)" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl outline-none font-mono bg-transparent" style={{color: 'var(--text-main)'}} onChange={e=>verifyHash(e.target.value)} />
        </div>
      )}

      {tab === 'title' && (
        <div className="space-y-4">
          <input type="text" placeholder="Titre de l'œuvre (ex: Mon premier roman)" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl outline-none bg-transparent" style={{color: 'var(--text-main)'}} value={titleQuery} onChange={e=>setTitleQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchByTitle()} />
          <button onClick={searchByTitle} className="w-full bg-[#4A90C2] text-white py-3 rounded-xl font-bold">Rechercher</button>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-5">
          
          {/* Filtres de la frise */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3 flex flex-col gap-3">
            <div className="flex bg-[var(--bg-main)] p-1 rounded-lg">
              <button onClick={() => setTimelineMode('live')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${timelineMode === 'live' ? 'bg-white shadow text-[#E76F51]' : 'opacity-50'}`}>En direct</button>
              <button onClick={() => setTimelineMode('period')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${timelineMode === 'period' ? 'bg-white shadow text-[#E76F51]' : 'opacity-50'}`}>Par période</button>
            </div>
            
            {timelineMode === 'period' && (
              <div className="flex gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 border border-[var(--border-color)] rounded-lg p-2 text-xs bg-transparent" style={{color: 'var(--text-main)'}} />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 border border-[var(--border-color)] rounded-lg p-2 text-xs bg-transparent" style={{color: 'var(--text-main)'}} />
              </div>
            )}
          </div>

          {timelineLoading ? (
            <p className="text-center font-mono text-[var(--text-muted)] py-10">Synchronisation...</p>
          ) : timelineData.length === 0 ? (
            <p className="text-center italic text-[var(--text-muted)] py-10">Aucun sceau sur cette période.</p>
          ) : (
            <div className="relative pl-6">
              {/* La ligne verticale */}
              <div className="absolute left-2.5 top-2 bottom-0 w-0.5 bg-[#E76F51] opacity-30"></div>

              <div className="space-y-6">
                {timelineData.map((item, index) => (
                  <div key={item.id} className="relative animate-fade-in">
                    {/* Le point */}
                    <div className="absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full bg-[#E76F51] border-2 border-[var(--bg-main)] shadow-sm"></div>
                    
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-3 rounded-xl shadow-sm hover:border-[#E76F51] transition">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-xs" style={{color: 'var(--text-main)'}}>@{item.author}</span>
                        <span className="text-[0.6rem] font-mono text-[var(--text-muted)]">{timeAgo(item.timestamp)}</span>
                      </div>
                      <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{item.title}</div>
                      <div className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-1">{item.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab !== 'pulse' && result && (
        <div className={`mt-8 p-6 rounded-2xl border-2 ${result.found ? 'bg-[var(--bg-surface)] border-[#7A9B5A]' : 'bg-[#FDF4F0] border-[#D64545]'}`}>
          {result.found ? (
            <div>
              <div className="text-center mb-6">
                <div className="text-3xl mb-2"></div>
                <h2 className="font-bold text-xl" style={{color: 'var(--text-main)'}}>{tab === 'title' ? 'ŒUVRES TROUVÉES' : 'FICHIER AUTHENTIQUE'}</h2>
                <p className="text-sm text-[var(--text-muted)]">{result.seals.length} preuve(s)</p>
              </div>
              <div className="space-y-4">
                {result.seals.map((seal: any, index: number) => (
                  <div key={index} className={`p-4 rounded-xl border ${index === 0 ? 'border-[#E76F51] bg-[var(--bg-main)]' : 'border-[var(--border-color)]'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Par <span className="font-bold text-[#E76F51]">@{seal.author}</span> le {new Date(seal.timestamp).toLocaleString('fr-FR')}
                        </div>
                        {seal.type === 'project' && (
                          <div className="mt-2 inline-block bg-[#F0F6FC] border border-[#C9D8E8] text-[#2D6A9E] px-2 py-1 rounded text-[0.65rem] font-bold">
                            🛡️ Fait partie du dossier : {seal.project_title}
                          </div>
                        )}
                        {seal.hash && <div className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-2 break-all">Hash: {seal.hash}</div>}
                      </div>
                    </div>
                    {seal.is_hosted && seal.file_path && (
                      <a href={seal.file_path} target="_blank" className="mt-3 inline-block bg-[#4A90C2] text-white px-4 py-2 rounded-lg text-xs font-bold">⬇️ Télécharger l'œuvre</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center font-bold text-[#A02E2E]"> Aucune œuvre trouvée.</p>
          )}
        </div>
      )}
    </div>
  );
}
