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
  
  // États pour les commentaires
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLiking, setIsLiking] = useState(false);

  const qrRef = useRef<HTMLDivElement>(null);
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadFeed = () => {
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => { setSeals(data.seals || []); setLoading(false); });
  };

  useEffect(() => {
    loadFeed();
    fetch('/api/feed/trends').then(res => res.json()).then(data => setTrends(data.trends || []));
    if (myHandle) fetch(`/api/feed/friends?me=${myHandle}`).then(res => res.json()).then(data => setFriendsSeals(data.friends_seals || []));
  }, [myHandle]);

  // Charger les commentaires quand on clique sur une œuvre
  useEffect(() => {
    if (selectedSeal) {
      fetch(`/api/comments?seal_id=${selectedSeal.id}`)
        .then(r => r.json())
        .then(d => setComments(d.comments || []));
    }
  }, [selectedSeal]);

  async function submitComment() {
    if (!newComment.trim() || !myPubkey || !selectedSeal) return;
    const commentToSend = newComment;
    setNewComment('');

    // Optimistic UI
    const optimistic = { author: myHandle, content: commentToSend, created_at: new Date().toISOString() };
    setComments(prev => [...prev, optimistic]);

    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seal_id: selectedSeal.id, pubkey: myPubkey, content: commentToSend })
    });
    // On pourrait recharger les commentaires ici, mais l'optimistic UI suffit pour la V1
  }

  async function handleLike() {
    if (!myPubkey || !selectedSeal || isLiking) return;
    setIsLiking(true);
    await fetch('/api/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seal_id: selectedSeal.id, pubkey: myPubkey }) });
    // Mettre à jour le compteur localement
    setSelectedSeal({ ...selectedSeal, likes_count: (selectedSeal.likes_count || 0) + 1 });
    setTimeout(() => setIsLiking(false), 1000);
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
        <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-[#F4A261] transition">+ Sceller</Link>
      </div>

      {/* SECTION TENDANCES */}
      {trends.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2" style={{color: 'var(--text-main)'}}>🔥 Tendances</h2>
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

      {/* SECTION EFFET CERCLE */}
      {friendsSeals.length > 0 && (
        <div className="mb-8 bg-[#F0F6FC] border border-[#4A90C2] p-5 rounded-2xl">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2" style={{color: '#1E4A78'}}>👥 Ton cercle</h2>
          <div className="space-y-3">
            {friendsSeals.map(seal => (
              <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-white p-3 rounded-xl border border-[#C9D8E8] flex justify-between items-center cursor-pointer hover:shadow-sm">
                <div><span className="font-bold text-[#2D6A9E]">@{seal.author}</span> a scellé <span className="font-bold" style={{color: 'var(--text-main)'}}>"{seal.title}"</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIL GLOBAL */}
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
                  {seal.version_number > 1 && <span className="text-xs font-mono font-bold bg-[#FCEAD6] text-[#C44A2E] px-2 py-1 rounded">V{seal.version_number}</span>}
                </div>
                {seal.location && <span className="text-xs font-mono bg-[#FDF8F0] border border-[var(--border-color)] px-2 py-1 rounded">📍 {seal.location}</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">
                Par <Link href={`/u/${seal.author}`} onClick={e => e.stopPropagation()} className="font-bold text-[#E76F51] hover:underline">@{seal.author}</Link> • {new Date(seal.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* MODALE DE DÉTAIL (Avec commentaires et likes) */}
      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-3xl relative max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Header modale */}
            <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{color: 'var(--text-main)'}}>{selectedSeal.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">Par @{selectedSeal.author}</p>
              </div>
              <button onClick={() => setSelectedSeal(null)} className="text-2xl opacity-50 hover:opacity-100">✕</button>
            </div>

            {/* Corps défilant */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6 text-center">
                <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">Empreinte SHA-256</p>
                <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{selectedSeal.hash || "Non disponible"}</p>
              </div>
              
              <div className="flex gap-2 mb-8">
                <button onClick={handleLike} className="flex-1 bg-[#FDF4F0] border border-[#F4D0A8] text-[#C44A2E] py-2 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-[#FCE0D6] transition">
                  ❤️ J'aime {selectedSeal.likes_count ? `(${selectedSeal.likes_count})` : ''}
                </button>
                {selectedSeal.is_hosted && selectedSeal.file_path && (
                  <a href={selectedSeal.file_path} target="_blank" className="flex-1 text-center bg-[#E76F51] text-white py-2 rounded-xl font-bold shadow-md hover:bg-[#F4A261] transition">📂 Ouvrir</a>
                )}
                <button onClick={downloadPdf} className="bg-[var(--bg-main)] border border-[var(--border-color)] px-4 py-2 rounded-xl font-bold" title="Certificat PDF">📄</button>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/o/${selectedSeal.id}`); alert('Lien copié !'); }} className="bg-[#F0F6FC] border border-[#C9D8E8] px-4 py-2 rounded-xl text-[#2D6A9E] font-bold" title="Partager">🔗</button>
              </div>

              {/* SECTION COMMENTAIRES */}
              <h3 className="font-bold text-lg mb-4" style={{color: 'var(--text-main)'}}>Commentaires ({comments.length})</h3>
              <div className="space-y-3 mb-4">
                {comments.map((c, i) => (
                  <div key={i} className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs text-[#E76F51]">@{c.author}</span>
                      <span className="text-[0.6rem] font-mono text-[var(--text-muted)]">{new Date(c.created_at).toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <p className="text-sm" style={{color: 'var(--text-main)'}}>{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">Sois le premier à commenter.</p>}
              </div>
            </div>

            {/* Input commentaire fixé en bas */}
            {myHandle && (
              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="flex gap-2">
                  <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ajouter un commentaire..." className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none" style={{color: 'var(--text-main)'}} onKeyDown={e => e.key === 'Enter' && submitComment()} />
                  <button onClick={submitComment} className="bg-[#E76F51] text-white px-4 rounded-xl font-bold">Envoyer</button>
                </div>
              </div>
            )}

            <div ref={qrRef} className="hidden">
              <QRCodeCanvas value={`${window.location.origin}/o/${selectedSeal.id}`} size={256} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
