'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const [attachmentType, setAttachmentType] = useState('text');

  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadFeed = () => {
    setLoading(true);
    fetch(`/api/feed?me=${myHandle || ''}&category=${activeCategory}`)
      .then(res => res.json())
      .then(data => { setSeals(data.seals || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loadStories = () => {
    fetch('/api/feed/stories')
      .then(r => r.json())
      .then(d => setStories(d.stories || []))
      .catch(() => setStories([]));
  };

  useEffect(() => { loadFeed(); loadStories(); }, [myHandle, activeCategory]);

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
    const payload = {
      seal_id: selectedSeal.id, pubkey: myPubkey,
      content: attachmentType === 'text' ? newAttachment : "Regarde ça :",
      type: attachmentType,
      media_url: attachmentType === 'link' ? newAttachment : null,
    };
    await fetch('/api/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setNewAttachment('');
    fetch(`/api/attachments?seal_id=${selectedSeal.id}`).then(r => r.json()).then(d => setAttachments(d.attachments || []));
  }

  const rollRandom = async () => {
    const res = await fetch('/api/feed/random');
    const data = await res.json();
    if (data.seal) setSelectedSeal(data.seal);
    else if (data.reason === 'empty') alert("Le réseau est encore vide. Scelle la première œuvre !");
    else alert("Erreur réseau. Réessaie.");
  };

  const nextStory = () => {
    if (activeStoryIndex === null) return;
    if (activeStoryIndex < stories.length - 1) setActiveStoryIndex(activeStoryIndex + 1);
    else setActiveStoryIndex(null);
  };
  const prevStory = () => {
    if (activeStoryIndex === null) return;
    if (activeStoryIndex > 0) setActiveStoryIndex(activeStoryIndex - 1);
  };

  // Le vrai filtre : exclure les éphémères du feed classique
  const nonEphemeralSeals = seals.filter((s: any) => s.is_ephemeral !== true);

  return (
    <main className="min-h-screen p-6 font-serif max-w-3xl mx-auto relative">
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-24 right-6 bg-[#2C1810] text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-black transition" title="Retour en haut">↑</button>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl font-black" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51] italic">.</span></h1>
        <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Sceller</Link>
      </div>

      {/* STORIES */}
      {stories.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4 mb-2 snap-x hide-scrollbar">
          {stories.map((story, index) => (
            <div key={story.id} onClick={() => setActiveStoryIndex(index)} className="snap-start shrink-0 flex flex-col items-center cursor-pointer group">
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#E76F51] to-[#F4A261] group-hover:scale-105 transition">
                <div className="w-full h-full bg-[var(--bg-surface)] rounded-full border-2 border-[var(--bg-surface)] flex items-center justify-center font-bold text-xl overflow-hidden relative">
                  {story.file_path && story.is_hosted ? (
                    <img src={story.file_path} alt="story" className="w-full h-full object-cover" />
                  ) : (
                    <span className="opacity-70">{story.author[0].toUpperCase()}</span>
                  )}
                  <span className="absolute bottom-0 right-0 bg-[#E76F51] text-white text-[0.5rem] px-1 rounded-tl-md">⏳</span>
                </div>
              </div>
              <span className="text-[0.6rem] font-bold mt-1 truncate w-16 text-center" style={{color: 'var(--text-main)'}}>@{story.author}</span>
            </div>
          ))}
        </div>
      )}

      {/* FILTRES + SURPRISE */}
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

      {/* FEED */}
      {loading ? (
        <p className="text-center font-mono py-10">Connexion...</p>
      ) : (
        <div className="grid gap-6 mb-10">
          {nonEphemeralSeals.map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>{seal.title}</h2>
                {seal.ots_proof && <span title="Ancré sur Bitcoin" className="text-lg">⛓️</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">Par @{seal.author} • {seal.category}</p>
              {seal.description && <p className="text-sm text-[var(--text-muted)] italic line-clamp-2">{seal.description}</p>}
            </div>
          ))}
          {nonEphemeralSeals.length === 0 && (
            <p className="text-center italic text-[var(--text-muted)] py-10">Aucune œuvre dans cette catégorie.</p>
          )}
        </div>
      )}

      {/* LECTEUR STORY */}
      {activeStoryIndex !== null && stories[activeStoryIndex] && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="flex gap-1 p-2 absolute top-0 w-full z-10">
            {stories.map((_, i) => (
              <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                {i === activeStoryIndex && <div className="h-full bg-white animate-[progress_5s_linear_forwards]"></div>}
                {i < activeStoryIndex && <div className="h-full bg-white w-full"></div>}
              </div>
            ))}
          </div>

          <button onClick={() => setActiveStoryIndex(null)} className="absolute top-6 right-4 text-white text-2xl z-20">✕</button>

          {/* Zones de tap pour navigation */}
          <div className="absolute inset-0 flex z-[5]">
            <div className="w-1/3 h-full cursor-pointer" onClick={prevStory}></div>
            <div className="flex-1"></div>
            <div className="w-1/3 h-full cursor-pointer" onClick={nextStory}></div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-[6] pointer-events-none">
            {stories[activeStoryIndex].file_path && stories[activeStoryIndex].is_hosted ? (
              <img src={stories[activeStoryIndex].file_path} alt="story" className="max-h-[70vh] rounded-xl object-contain pointer-events-auto" />
            ) : (
              <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border-4 border-[#E76F51] max-w-sm w-full pointer-events-auto">
                <h2 className="text-3xl font-bold mb-4" style={{color: 'var(--text-main)'}}>{stories[activeStoryIndex].title}</h2>
                <p className="text-[var(--text-muted)] italic">Sceau éphémère de @{stories[activeStoryIndex].author}</p>
              </div>
            )}
            <Link href={`/o/${stories[activeStoryIndex].id}`} className="mt-8 bg-white/10 text-white px-6 py-3 rounded-full font-bold backdrop-blur-md border border-white/20 hover:bg-white/20 transition pointer-events-auto">
              Voir la preuve complète
            </Link>
          </div>
        </div>
      )}

      {/* MODALE CLASSIQUE */}
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
              {selectedSeal.hash && (
                <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] mb-6 text-center">
                  <p className="text-xs font-mono font-bold text-[var(--text-muted)] mb-1">SHA-256</p>
                  <p className="text-xs font-mono break-all" style={{color: 'var(--text-main)'}}>{selectedSeal.hash}</p>
                  {selectedSeal.ots_proof && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-[#F5F9EE] border border-[#A8C77E] text-[#5D7A3A] px-2 py-1 rounded text-[0.6rem] font-bold">
                      ⛓️ Preuve Bitcoin (Ancrée)
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>📝 Description du créateur</h3>
                <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] text-sm italic" style={{color: 'var(--text-main)'}}>
                  {selectedSeal.description || "Aucune description fournie."}
                </div>
              </div>

              <h3 className="font-bold text-lg mb-4" style={{color: 'var(--text-main)'}}>🎬 Créations rattachées ({attachments.length})</h3>
              <div className="space-y-3 mb-6">
                {attachments.map((a, i) => (
                  <div key={i} className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)]">
                    <span className="font-bold text-xs text-[#E76F51]">@{a.author}</span>
                    {a.type === 'link' ? (
                      <a href={a.media_url} target="_blank" className="block text-sm text-[#4A90C2] hover:underline">🔗 Voir le lien</a>
                    ) : (
                      <p className="text-sm mt-1" style={{color: 'var(--text-main)'}}>{a.content}</p>
                    )}
                  </div>
                ))}
                {attachments.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">Sois le premier à réagir à cette œuvre.</p>}
              </div>
            </div>

            {myHandle && (
              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="flex bg-[var(--bg-main)] p-1 rounded-lg mb-2">
                  <button onClick={() => setAttachmentType('text')} className={`flex-1 py-1 text-xs font-bold rounded ${attachmentType === 'text' ? 'bg-white shadow' : 'opacity-50'}`}>💬 Texte</button>
                  <button onClick={() => setAttachmentType('link')} className={`flex-1 py-1 text-xs font-bold rounded ${attachmentType === 'link' ? 'bg-white shadow' : 'opacity-50'}`}>🔗 Lien</button>
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
