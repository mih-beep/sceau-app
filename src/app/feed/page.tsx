'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { generateCertificate } from '@/lib/pdf';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  
  // États pour les créations rattachées
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const [attachmentType, setAttachmentType] = useState('text'); // text | link
  
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadFeed = () => {
    fetch(`/api/feed?me=${myHandle || ''}`)
      .then(res => res.json())
      .then(data => { setSeals(data.seals || []); setLoading(false); });
  };

  useEffect(() => { loadFeed(); }, [myHandle]);

  // Charger les créations rattachées quand on ouvre une œuvre
  useEffect(() => {
    if (selectedSeal) {
      fetch(`/api/attachments?seal_id=${selectedSeal.id}`)
        .then(r => r.json())
        .then(d => setAttachments(d.attachments || []));
    }
  }, [selectedSeal]);

  async function submitAttachment() {
    if (!newAttachment.trim() || !myPubkey || !selectedSeal) return;
    
    const payload = {
      seal_id: selectedSeal.id,
      pubkey: myPubkey,
      content: attachmentType === 'text' ? newAttachment : "Regarde ça :",
      type: attachmentType,
      media_url: attachmentType === 'link' ? newAttachment : null
    };

    await fetch('/api/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    setNewAttachment('');
    // Recharger les créations
    fetch(`/api/attachments?seal_id=${selectedSeal.id}`).then(r => r.json()).then(d => setAttachments(d.attachments || []));
  }

  return (
    <main className="min-h-screen p-6 font-serif max-w-3xl mx-auto relative">
      {/* Bouton Retour en haut */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-24 right-6 bg-[#2C1810] text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-black transition" title="Retour en haut">↑</button>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-black" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51] italic">.</span></h1>
        <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Sceller</Link>
      </div>

      {loading ? (
         <p className="text-center font-mono py-10">Connexion...</p>
      ) : (
        <div className="grid gap-6 mb-10">
          {seals.map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>{seal.title}</h2>
              <p className="text-sm text-[var(--text-muted)] mb-2">Par @{seal.author}</p>
            </div>
          ))}
        </div>
      )}

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
              <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6 text-center">
                <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">SHA-256</p>
                <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{selectedSeal.hash}</p>
              </div>

              {/* SECTION CRÉATIONS RATTACHÉES */}
              <h3 className="font-bold text-lg mb-4" style={{color: 'var(--text-main)'}}>🎬 Créations rattachées ({attachments.length})</h3>
              
              <div className="space-y-3 mb-6">
                {attachments.map((a, i) => (
                  <div key={i} className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-[#E76F51]">@{a.author}</span>
                    </div>
                    {a.type === 'link' ? (
                      <a href={a.media_url} target="_blank" className="block bg-white border border-[var(--border-color)] p-3 rounded-lg text-sm text-[#4A90C2] hover:underline overflow-hidden text-ellipsis whitespace-nowrap">
                        🔗 Voir le lien (Insta/Twitter/etc.)
                      </a>
                    ) : (
                      <p className="text-sm" style={{color: 'var(--text-main)'}}>{a.content}</p>
                    )}
                  </div>
                ))}
                {attachments.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">Sois le premier à réagir à cette œuvre.</p>}
              </div>
            </div>

            {/* INPUT POUR AJOUTER UNE CRÉATION */}
            {myHandle && (
              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="flex bg-[var(--bg-main)] p-1 rounded-lg mb-2">
                  <button onClick={() => setAttachmentType('text')} className={`flex-1 py-1 text-xs font-bold rounded ${attachmentType === 'text' ? 'bg-white shadow' : 'opacity-50'}`}>💬 Texte</button>
                  <button onClick={() => setAttachmentType('link')} className={`flex-1 py-1 text-xs font-bold rounded ${attachmentType === 'link' ? 'bg-white shadow' : 'opacity-50'}`}>🔗 Lien (Insta, X, etc.)</button>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newAttachment} onChange={e => setNewAttachment(e.target.value)} placeholder={attachmentType === 'text' ? "Ajouter un commentaire..." : "Coller un lien (https://...)"} className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none" style={{color: 'var(--text-main)'}} onKeyDown={e => e.key === 'Enter' && submitAttachment()} />
                  <button onClick={submitAttachment} className="bg-[#E76F51] text-white px-4 rounded-xl font-bold">Publier</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
