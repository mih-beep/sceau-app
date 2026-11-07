'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Feed() {
  const router = useRouter();
  const [seals, setSeals] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  
  // États pour les créations rattachées
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const [attachmentType, setAttachmentType] = useState<'link' | 'text'>('text'); 
  const [attachmentMetrics, setAttachmentMetrics] = useState('');
  
  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadFeed = () => {
    setLoading(true);
    fetch(`/api/feed?me=${myHandle || ''}&category=${activeCategory}`)
      .then(res => res.json())
      .then(data => { setSeals(data.seals || []); setLoading(false); });
  };

  const loadStories = () => {
    fetch('/api/feed/stories')
      .then(res => res.json())
      .then(data => setStories(data.stories || []));
  };

  useEffect(() => { 
    loadFeed(); 
    loadStories();
  }, [myHandle, activeCategory]);

  useEffect(() => {
    if (selectedSeal) {
      fetch(`/api/attachments?seal_id=${selectedSeal.id}`)
        .then(r => r.json())
        .then(d => setAttachments(d.attachments || []));
    }
  }, [selectedSeal]);

  useEffect(() => {
    if (activeStoryIndex !== null) {
      const timer = setTimeout(() => {
        if (activeStoryIndex < stories.length - 1) setActiveStoryIndex(activeStoryIndex + 1);
        else setActiveStoryIndex(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeStoryIndex, stories.length]);

  async function submitAttachment() {
    if (!newAttachment.trim() || !myPubkey || !selectedSeal) return;
    
    // On prépare le texte avec les métriques si c'est un lien
    const finalContent = attachmentType === 'text' 
      ? newAttachment 
      : (attachmentMetrics ? `[${attachmentMetrics}]` : "Regarde ça :");

    const payload = {
      seal_id: selectedSeal.id, pubkey: myPubkey,
      content: finalContent,
      type: attachmentType, 
      media_url: attachmentType === 'link' ? newAttachment : null
    };
    
    await fetch('/api/attachments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setNewAttachment('');
    setAttachmentMetrics('');
    fetch(`/api/attachments?seal_id=${selectedSeal.id}`).then(r => r.json()).then(d => setAttachments(d.attachments || []));
  }

  const rollRandom = async () => {
    const res = await fetch('/api/feed/random');
    const data = await res.json();
    if (data.seal) {
      setSelectedSeal(data.seal);
      // CORRECTION DU BUG 404 ICI
      if (myPubkey) {
        fetch(`/api/seal/${data.seal.id}/log-view`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ pubkey: myPubkey, context: 'random' }) 
        }).catch(() => {});
      }
    } else if (data.reason === 'empty') {
      alert("Le réseau est encore vide. Scelle la première œuvre !");
    } else {
      alert("Erreur réseau.");
    }
  };

  return (
    <main className="min-h-screen p-6 font-sans max-w-3xl mx-auto relative">
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-24 right-6 bg-[#2C1810] text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-black transition" title="Retour en haut">↑</button>
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl font-bold" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51] italic">.</span></h1>
        <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Sceller</Link>
      </div>

      {stories.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4 mb-2 snap-x hide-scrollbar">
          {stories.map((story, index) => (
            <div key={story.id} onClick={() => setActiveStoryIndex(index)} className="snap-start shrink-0 flex flex-col items-center cursor-pointer group">
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#E76F51] to-[#F4A261] group-hover:scale-105 transition">
                <div className="w-full h-full bg-[var(--bg-surface)] rounded-full border-2 border-[var(--bg-surface)] flex items-center justify-center font-bold text-xl overflow-hidden relative">
                  {story.file_path && story.is_hosted ? <img src={story.file_path} alt="story" className="w-full h-full object-cover" /> : <span className="opacity-70">{story.author[0].toUpperCase()}</span>}
                  <span className="absolute bottom-0 right-0 bg-[#E76F51] text-white text-[0.5rem] px-1 rounded-tl-md">⏳</span>
                </div>
              </div>
              <span className="text-[0.6rem] font-bold mt-1 truncate w-16 text-center" style={{color: 'var(--text-main)'}}>@{story.author}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x flex-1 hide-scrollbar">
          {['all', 'Art', 'Musique', 'Code', 'Écrit'].map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition border ${activeCategory === cat ? 'bg-[#E76F51] text-white border-[#E76F51] shadow-md' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[#E76F51]'}`}>
              {cat === 'all' ? '🌍 Tout' : cat}
            </button>
          ))}
        </div>
        <button onClick={rollRandom} className="shrink-0 bg-[#2C1810] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:scale-105 transition flex items-center gap-1">
          🎲 Surprise
        </button>
      </div>

      {loading ? (
         <p className="text-center font-mono py-10">Connexion...</p>
      ) : (
        <div className="grid gap-6 mb-10">
          {seals.filter(s => !s.is_ephemeral).map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</h2>
                {seal.ots_proof && <span title="Ancré sur Bitcoin" className="text-lg">⛓️</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">Par @{seal.author} • {seal.category}</p>
              <p className="text-sm text-[var(--text-muted)] italic line-clamp-2">{seal.description}</p>
            </div>
          ))}
          {seals.length === 0 && <p className="text-center italic text-[var(--text-muted)] py-10">Aucune œuvre dans cette catégorie.</p>}
        </div>
      )}

      {activeStoryIndex !== null && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="flex gap-1 p-2 bg-gradient-to-b from-black/50 to-transparent absolute top-0 w-full z-10">
            {stories.map((_, i) => (
              <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                {i === activeStoryIndex && <div className="h-full bg-white animate-[progress_5s_linear_forwards]"></div>}
                {i < activeStoryIndex && <div className="h-full bg-white w-full"></div>}
              </div>
            ))}
          </div>
          <button onClick={() => setActiveStoryIndex(null)} className="absolute top-6 right-4 text-white text-2xl z-20">✕</button>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
             {stories[activeStoryIndex].file_path && stories[activeStoryIndex].is_hosted ? (
                <img src={stories[activeStoryIndex].file_path} alt="story" className="max-h-[70vh] rounded-xl object-contain" />
             ) : (
                <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border-4 border-[#E76F51] max-w-sm w-full">
                  <h2 className="text-3xl font-bold mb-4" style={{color: 'var(--text-main)'}}>{stories[activeStoryIndex].title}</h2>
                  <p className="text-[var(--text-muted)] italic">Sceau éphémère de @{stories[activeStoryIndex].author}</p>
                </div>
             )}
             <Link href={`/o/${stories[activeStoryIndex].id}`} className="mt-8 bg-white/10 text-white px-6 py-3 rounded-full font-bold backdrop-blur-md border border-white/20 hover:bg-white/20 transition">Voir la preuve complète</Link>
          </div>
        </div>
      )}

      {/* MODALE D'UNE ŒUVRE AVEC CARROUSEL DE CRÉATIONS */}
      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-3xl relative max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{color: 'var(--text-main)'}}>{selectedSeal.title}</h2>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-[var(--text-muted)]">Par @{selectedSeal.author}</p>
                  {myHandle && myHandle !== selectedSeal.author && (
                    <button onClick={() => router.push(`/messages?user=${selectedSeal.author}`)} className="text-xs font-bold text-[#E76F51] hover:underline flex items-center gap-1 bg-[#FDF4F0] px-2 py-1 rounded-md">💬 Contacter</button>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedSeal(null)} className="text-2xl opacity-50">✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6 text-center relative">
                <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">SHA-256</p>
                <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{selectedSeal.hash}</p>
                {selectedSeal.ots_proof && <div className="mt-2 inline-flex items-center gap-1 bg-[#F5F9EE] border border-[#A8C77E] text-[#5D7A3A] px-2 py-1 rounded text-[0.6rem] font-bold">⛓️ Preuve Bitcoin (Ancrée)</div>}
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>📝 Description du créateur</h3>
                <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] text-sm italic" style={{color: 'var(--text-main)'}}>
                  {selectedSeal.description || "Aucune description fournie."}
                </div>
              </div>

              {/* CARROUSEL DES CRÉATIONS RATTACHÉES */}
              <h3 className="font-bold text-lg mb-2 flex justify-between items-end" style={{color: 'var(--text-main)'}}>
                🎬 Créations rattachées 
                <span className="text-xs font-mono bg-[#E76F51] text-white px-2 py-0.5 rounded-full">{attachments.length}</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-3 italic">Glissez pour voir les réactions et les liens externes.</p>
              
              <div className="flex gap-3 overflow-x-auto pb-4 snap-x hide-scrollbar">
                {attachments.map((a, i) => {
                  const isLink = a.type === 'link';
                  const metricsMatch = a.content.match(/\[(.*?)\]/);
                  const metrics = metricsMatch ? metricsMatch[1] : null;

                  return (
                    <div key={i} className={`snap-start shrink-0 w-64 p-4 rounded-2xl border-2 flex flex-col justify-between ${isLink ? 'bg-[#F0F6FC] border-[#4A90C2]' : 'bg-[var(--bg-main)] border-[var(--border-color)]'}`}>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`font-bold text-xs ${isLink ? 'text-[#2D6A9E]' : 'text-[#E76F51]'}`}>@{a.author}</span>
                          {isLink ? <span className="text-[0.6rem] bg-[#4A90C2] text-white px-1.5 py-0.5 rounded">🌍 Externe</span> : <span className="text-[0.6rem] bg-[#E76F51] text-white px-1.5 py-0.5 rounded">🛡️ SCEAU</span>}
                        </div>
                        {isLink ? (
                          <>
                            {metrics && <div className="text-xs font-bold text-[#2D6A9E] mb-2">{metrics}</div>}
                            <a href={a.media_url} target="_blank" rel="noopener" className="block text-sm text-[#4A90C2] hover:underline font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                              🔗 Voir le post
                            </a>
                          </>
                        ) : (
                          <p className="text-sm mt-1" style={{color: 'var(--text-main)'}}>{a.content}</p>
                        )}
                      </div>
                      <div className="text-[0.55rem] font-mono text-[var(--text-muted)] mt-3 text-right">
                        {new Date(a.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  );
                })}
                {attachments.length === 0 && (
                  <div className="w-full text-center py-6 border-2 border-dashed border-[var(--border-color)] rounded-xl">
                    <p className="text-xs text-[var(--text-muted)] italic">Aucune création pour l'instant. Lancez la vôtre !</p>
                  </div>
                )}
              </div>
            </div>

            {myHandle && (
              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="flex bg-[var(--bg-main)] p-1 rounded-lg mb-2">
                  <button onClick={() => setAttachmentType('text')} className={`flex-1 py-1 text-xs font-bold rounded ${attachmentType === 'text' ? 'bg-white shadow' : 'opacity-50'}`}>💬 Texte SCEAU</button>
                  <button onClick={() => setAttachmentType('link')} className={`flex-1 py-1 text-xs font-bold rounded ${attachmentType === 'link' ? 'bg-white shadow' : 'opacity-50'}`}>🔗 Lien Externe</button>
                </div>
                <div className="flex flex-col gap-2">
                  <input type="text" value={newAttachment} onChange={e => setNewAttachment(e.target.value)} placeholder={attachmentType === 'text' ? "Écrire un commentaire..." : "Coller un lien (TikTok, Instagram...)"} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none" style={{color: 'var(--text-main)'}} />
                  
                  {attachmentType === 'link' && (
                    <input type="text" value={attachmentMetrics} onChange={e => setAttachmentMetrics(e.target.value)} placeholder="Métriques (ex: ❤️ 1.2k, 👁️ 50k) - Optionnel" className="w-full bg-[#F0F6FC] border border-[#C9D8E8] rounded-xl px-4 py-2 text-xs outline-none text-[#2D6A9E] font-bold" />
                  )}
                  
                  <button onClick={submitAttachment} className="w-full bg-[#E76F51] text-white py-2 rounded-xl font-bold text-sm">Publier la création</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
