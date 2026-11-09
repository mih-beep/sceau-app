#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Écrasement du fichier feed/page.tsx avec la version finale"

cat > src/app/feed/page.tsx << 'EOF'
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

  // Barre de recherche globale
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Créations rattachées (Feed interne)
  const [creations, setCreations] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Feed Global
  const [showCreationsFeed, setShowCreationsFeed] = useState(false);
  const [globalCreations, setGlobalCreations] = useState<any[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  // Modale de création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createContent, setCreateContent] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const myHandle = typeof window !== 'undefined' ? localStorage.getItem('sceau_handle') : null;
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  const loadFeed = () => {
    setLoading(true);
    fetch(`/api/feed?me=${myHandle || ''}&category=${activeCategory}`)
      .then(res => res.json())
      .then(data => { setSeals(data.seals || []); setLoading(false); });
  };

  const loadStories = () => {
    fetch('/api/feed/stories').then(res => res.json()).then(data => setStories(data.stories || []));
  };

  const loadCreations = (sealId: string) => {
    fetch(`/api/creations?seal_id=${sealId}`).then(r => r.json()).then(d => setCreations(d.creations || []));
  };

  useEffect(() => { loadFeed(); loadStories(); }, [myHandle, activeCategory]);

  useEffect(() => {
    if (selectedSeal) loadCreations(selectedSeal.id);
  }, [selectedSeal]);

  const loadGlobalFeed = () => {
    setLoadingGlobal(true);
    fetch('/api/creations/global')
      .then(r => r.json())
      .then(d => { setGlobalCreations(d.creations || []); setLoadingGlobal(false); })
      .catch(() => setLoadingGlobal(false));
  };

  useEffect(() => {
    if (showCreationsFeed) loadGlobalFeed();
  }, [showCreationsFeed]);

  useEffect(() => {
    if (activeStoryIndex !== null) {
      const timer = setTimeout(() => {
        if (activeStoryIndex < stories.length - 1) setActiveStoryIndex(activeStoryIndex + 1);
        else setActiveStoryIndex(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeStoryIndex, stories.length]);

  async function submitCreation() {
    if ((!createContent.trim() && !createFile) || !myPubkey || !selectedSeal) return;
    setIsCreating(true);

    const formData = new FormData();
    formData.append('seal_id', selectedSeal.id);
    formData.append('pubkey', myPubkey);
    formData.append('content', createContent);
    formData.append('type', createFile ? (createFile.type.startsWith('video') ? 'video' : 'image') : 'text');
    if (createFile) formData.append('file', createFile);

    await fetch('/api/creations', { method: 'POST', body: formData });
    
    setCreateContent('');
    setCreateFile(null);
    setShowCreateModal(false);
    setIsCreating(false);
    loadCreations(selectedSeal.id);
  }

  async function submitComment() {
    if (!newComment.trim() || !myPubkey || !selectedSeal) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('seal_id', selectedSeal.id);
    formData.append('pubkey', myPubkey);
    formData.append('content', newComment);
    formData.append('type', 'text');

    await fetch('/api/creations', { method: 'POST', body: formData });
    setNewComment('');
    loadCreations(selectedSeal.id);
    setIsSubmitting(false);
  }

  const rollRandom = async () => {
    const res = await fetch('/api/feed/random');
    const data = await res.json();
    if (data.seal) {
      setSelectedSeal(data.seal);
      if (myPubkey) {
        fetch(`/api/seal/${data.seal.id}/log-view`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ pubkey: myPubkey, context: 'random' }) 
        }).catch(() => {});
      }
    } else if (data.reason === 'empty') {
      alert("Le réseau est encore vide. Scelle la première œuvre !");
    } else {
      alert("Erreur réseau.");
    }
  };

  // === SI ON EST DANS LE FEED GLOBAL DES CRÉATIONS ===
  if (showCreationsFeed) {
    return (
      <div className="p-6 max-w-lg mx-auto font-sans min-h-screen bg-[var(--bg-main)] pb-20">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setShowCreationsFeed(false)} className="text-sm font-bold flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)]" style={{ color: 'var(--text-main)' }}>
            ← Retour
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Créations</h1>
        </div>

        {loadingGlobal ? (
           <p className="text-center font-mono py-10">Chargement des créations...</p>
        ) : globalCreations.length === 0 ? (
           <div className="text-center py-10 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)]">
             <p className="italic text-[var(--text-muted)]">Aucune création sur le réseau pour le moment.</p>
           </div>
        ) : (
          <div className="space-y-6">
            {globalCreations.map((c: any) => (
              <div key={c.id} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 flex justify-between items-center border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-xs">
                      {c.author[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>@{c.author}</div>
                      <div className="text-[0.6rem] text-[var(--text-muted)]">a publié une création</div>
                    </div>
                  </div>
                </div>

                {c.media_url && (
                  <div className="w-full bg-black flex justify-center max-h-[400px] overflow-hidden">
                    {c.type === 'video' ? (
                      <video src={c.media_url} controls className="max-h-[400px] w-full object-contain" />
                    ) : (
                      <img src={c.media_url} alt="création" className="w-full object-cover max-h-[400px]" />
                    )}
                  </div>
                )}

                <div className="p-4">
                  {c.content && <p className="text-sm mb-4" style={{ color: 'var(--text-main)' }}>{c.content}</p>}
                  
                  <button 
                    onClick={() => { setShowCreationsFeed(false); setSelectedSeal({ id: c.seal_id, title: c.seal_title, author: c.author, description: '' }); }}
                    className="w-full text-left bg-[var(--bg-main)] border border-[var(--border-color)] p-3 rounded-xl hover:border-[#E76F51] transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-[0.6rem] font-mono font-bold text-[var(--text-muted)] uppercase">Sceau fondateur</div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>{c.seal_title}</div>
                    </div>
                    <span className="text-[#E76F51] group-hover:translate-x-1 transition">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // === SINON, ON EST DANS LE FEED NORMAL (CADRANS) ===
  return (
    <main className="min-h-screen p-6 font-sans max-w-3xl mx-auto relative">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl font-bold" style={{ color: 'var(--text-main)' }}>SCEAU<span className="text-[#E76F51] italic">.</span></h1>
        <Link href="/seal" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">+ Sceller</Link>
      </div>

      {/* BARRE DE RECHERCHE GLOBALE */}
      <div className="mb-6 relative z-40">
        <input 
          type="text" 
          placeholder="Rechercher une œuvre ou un créateur..." 
          className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl outline-none bg-[var(--bg-surface)]"
          style={{color: 'var(--text-main)'}}
          value={searchQuery}
          onChange={async (e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.length > 2) {
              const res = await fetch(`/api/search?q=${encodeURIComponent(e.target.value)}`);
              const d = await res.json();
              setSearchResults(d.results || []);
            } else {
              setSearchResults([]);
            }
          }}
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
             {searchResults.map(r => (
                <div key={r.id} onClick={() => { setSelectedSeal(r); setSearchResults([]); setSearchQuery(''); }} className="p-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-main)] cursor-pointer">
                   <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>{r.title}</div>
                   <div className="text-xs text-[var(--text-muted)]">Par @{r.author}</div>
                </div>
             ))}
          </div>
        )}
      </div>

      {/* Stories */}
      {stories.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4 mb-2 snap-x hide-scrollbar">
          {stories.map((story, index) => (
            <div key={story.id} onClick={() => setActiveStoryIndex(index)} className="snap-start shrink-0 flex flex-col items-center cursor-pointer group">
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#E76F51] to-[#F4A261]">
                <div className="w-full h-full bg-[var(--bg-surface)] rounded-full border-2 border-[var(--bg-surface)] flex items-center justify-center font-bold text-xl overflow-hidden relative">
                  {story.file_path && story.is_hosted ? <img src={story.file_path} alt="story" className="w-full h-full object-cover" /> : <span className="opacity-70">{story.author[0].toUpperCase()}</span>}
                  <span className="absolute bottom-0 right-0 bg-[#E76F51] text-white text-[0.5rem] px-1 rounded-tl-md">⏳</span>
                </div>
              </div>
              <span className="text-[0.6rem] font-bold mt-1 truncate w-16 text-center" style={{ color: 'var(--text-main)' }}>@{story.author}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toggle Feed Cadran / Feed Créations */}
      <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl mb-4">
        <button className="flex-1 py-2 text-sm font-bold rounded-lg bg-[var(--bg-main)] shadow" style={{ color: 'var(--text-main)' }}>Cadrans (Œuvres)</button>
        <button onClick={() => setShowCreationsFeed(true)} className="flex-1 py-2 text-sm font-bold rounded-lg opacity-50">Créations (Feed)</button>
      </div>

      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x flex-1 hide-scrollbar">
          {['all', 'Art', 'Musique', 'Code', 'Écrit'].map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition border ${activeCategory === cat ? 'bg-[#E76F51] text-white border-[#E76F51] shadow-md' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)]'}`}>
              {cat === 'all' ? '🌍 Tout' : cat}
            </button>
          ))}
        </div>
        <button onClick={rollRandom} className="shrink-0 bg-[#2C1810] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1">🎲 Surprise</button>
      </div>

      {loading ? (
         <p className="text-center font-mono py-10">Connexion...</p>
      ) : (
        <div className="grid gap-6 mb-10">
          {seals.filter(s => !s.is_ephemeral).map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{seal.title}</h2>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">Par @{seal.author} • {seal.category}</p>
              <p className="text-sm text-[var(--text-muted)] italic line-clamp-2">{seal.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* === LE NOUVEAU CADRAN === */}
      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-3xl relative max-h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            
            {/* Header du Cadran */}
            <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-start bg-[var(--bg-surface)] z-10">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-main)' }}>{selectedSeal.title}</h2>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-[var(--text-muted)]">Par @{selectedSeal.author}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSeal(null)} className="text-2xl opacity-50 hover:opacity-100">✕</button>
            </div>

            {/* Contenu */}
            <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-main)]">
              
              {/* Bloc Description */}
              <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm mb-6">
                <h3 className="text-xs font-mono font-bold uppercase mb-2 text-[var(--text-muted)]">Description du créateur</h3>
                <p className="text-sm italic" style={{ color: 'var(--text-main)' }}>{selectedSeal.description || "Aucune description fournie."}</p>
              </div>

              {/* Le fameux bouton "Voir les créations" */}
              <div className="mb-6">
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-[#E76F51] bg-[#FDF4F0] hover:bg-[#FCEAD6] transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎬</span>
                    <div className="text-left">
                      <div className="font-bold text-[#C44A2E]">
                        {creations.length > 0 ? `${creations.length} création(s) rattachée(s)` : "Aucune création pour l'instant"}
                      </div>
                      <div className="text-xs text-[#C44A2E] opacity-80">
                        {creations.length > 0 ? "Cliquez pour explorer et commenter" : "Lancez la vôtre !"}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-xl text-[#C44A2E] group-hover:translate-x-1 transition">→</span>
                </button>
              </div>

              {/* Aperçu des 2 dernières créations (ou commentaires) */}
              <div className="space-y-3 mb-6">
                {creations.slice(0, 2).map((c, i) => (
                  <div key={i} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-xs" style={{ color: 'var(--text-main)' }}>@{c.author}</span>
                      <span className="text-[0.6rem] bg-[#E76F51] text-white px-2 py-0.5 rounded">Texte</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-main)' }}>{c.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Barre de commentaire */}
            {myHandle && (
              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newComment} 
                    onChange={e => setNewComment(e.target.value)} 
                    placeholder="Écrire un commentaire SCEAU..." 
                    className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#E76F51]" 
                    style={{ color: 'var(--text-main)' }} 
                    onKeyDown={e => e.key === 'Enter' && submitComment()}
                  />
                  <button 
                    onClick={submitComment} 
                    disabled={isSubmitting}
                    className="bg-[#E76F51] text-white px-6 rounded-xl font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? '...' : 'Publier'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MODALE : CRÉER UNE CRÉATION RATTACHÉE === */}
      {showCreateModal && selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Nouvelle Création</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-xl opacity-50 hover:opacity-100">✕</button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">Rattacher une création au sceau : <strong>{selectedSeal.title}</strong></p>

            <textarea 
              className="w-full border-2 border-[var(--border-color)] rounded-xl p-3 outline-none bg-transparent mb-4" 
              rows={3} 
              placeholder="Écris ton commentaire ou la description de ton média..."
              value={createContent}
              onChange={e => setCreateContent(e.target.value)}
              style={{ color: 'var(--text-main)' }}
            />

            <div className="mb-6">
              <label className="block text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-2">Média (Photo ou Vidéo)</label>
              <input 
                type="file" 
                accept="image/*,video/*" 
                onChange={e => setCreateFile(e.target.files?.[0] || null)} 
                className="w-full text-sm" 
              />
              {createFile && <p className="text-xs mt-2 text-[#5D7A3A] font-bold">📎 {createFile.name}</p>}
            </div>

            <button 
              onClick={submitCreation}
              disabled={isCreating || (!createContent.trim() && !createFile)}
              className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-50 transition"
            >
              {isCreating ? 'Publication...' : 'Publier la création'}
            </button>
          </div>
        </div>
      )}

      {/* Visionneuse Stories */}
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
                  <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>{stories[activeStoryIndex].title}</h2>
                  <p className="text-[var(--text-muted)] italic">Sceau éphémère de @{stories[activeStoryIndex].author}</p>
                </div>
             )}
             <Link href={`/o/${stories[activeStoryIndex].id}`} className="mt-8 bg-white/10 text-white px-6 py-3 rounded-full font-bold backdrop-blur-md border border-white/20">Voir la preuve complète</Link>
          </div>
        </div>
      )}
    </main>
  );
}
EOF

say "2/2 → Vérification du build"
npm run build

echo ""
echo -e "${GREEN}✅ Le Feed a été mis à jour avec succès.${NC}"
