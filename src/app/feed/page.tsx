'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tout');
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [commentText, setCommentText] = useState('');

  async function fetchFeed(q = '', cat = 'Tout') {
    const res = await fetch(`/api/feed?q=${q}&cat=${cat}`);
    const data = await res.json();
    setSeals(data.seals || []);
  }

  useEffect(() => { fetchFeed(search, category); }, [category]);

  const handleLike = async (id: string) => {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert("Connecte-toi pour aimer !");
    await fetch('/api/like', { method: 'POST', body: JSON.stringify({ seal_id: id, pubkey }) });
    fetchFeed(search, category); // Rafraîchit les compteurs
  };

  const handleComment = async () => {
    if (!commentText || !selectedSeal) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert("Connecte-toi pour commenter !");
    
    await fetch('/api/comment', { method: 'POST', body: JSON.stringify({ seal_id: selectedSeal.id, pubkey, content: commentText }) });
    setCommentText('');
    fetchFeed(search, category);
    // Mise à jour locale de la modale
    setSelectedSeal({ ...selectedSeal, comments_count: parseInt(selectedSeal.comments_count) + 1 });
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/oeuvre/${id}`);
    alert("Lien copié ! Partage-le sur les réseaux.");
  };

  return (
    <main className="min-h-screen bg-[#F5E9D8] text-[#2C1810] p-6 font-serif">
      <div className="max-w-3xl mx-auto">
        
        {/* Barre de recherche et titre */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-4xl font-black">SCEAU<span className="text-[#E76F51] italic">.</span></h1>
          <div className="flex gap-2 w-full md:w-auto">
            <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="border-2 border-[#EFE0CA] p-2 rounded-xl text-sm flex-1 outline-none" />
            <button onClick={() => fetchFeed(search, category)} className="bg-[#2C1810] text-white px-4 py-2 rounded-xl text-sm font-bold">Go</button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
          {['Tout', 'Art', 'Musique', 'Code', 'Écrit'].map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-4 py-1 rounded-full text-xs font-mono font-bold whitespace-nowrap ${category === c ? 'bg-[#E76F51] text-white' : 'bg-white border border-[#EFE0CA] text-[#A89070]'}`}>{c}</button>
          ))}
        </div>

        {/* Grille du Feed */}
        <div className="grid gap-6">
          {seals.map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-white p-6 rounded-2xl border border-[#E8D5B8] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold">{seal.title}</h2>
                <span className="text-xs font-mono bg-[#F0F9F7] text-[#1E7A70] px-2 py-1 rounded">Scellé</span>
              </div>
              <p className="text-sm text-[#7A5A3A] mb-2">Par <span className="font-bold">@{seal.author}</span> • {new Date(seal.timestamp).toLocaleDateString('fr-FR')}</p>
              {seal.description && <p className="text-sm italic mb-4">"{seal.description}"</p>}
              
              <div className="flex gap-4 text-sm font-mono text-[#A89070] border-t border-[#F5E9D8] pt-4">
                <span onClick={(e) => {e.stopPropagation(); handleLike(seal.id);}} className="cursor-pointer hover:text-[#E76F51]">❤️ {seal.likes_count}</span>
                <span>💬 {seal.comments_count}</span>
                <span onClick={(e) => {e.stopPropagation(); copyLink(seal.id);}} className="cursor-pointer hover:text-[#E76F51]">🔗 Partager</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODALE DE DÉTAIL (Au clic sur une carte) */}
      {selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSeal(null)}>
          <div className="bg-[#FFFCF7] w-full max-w-lg rounded-3xl p-8 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedSeal(null)} className="absolute top-4 right-4 text-2xl">✕</button>
            
            <h2 className="text-3xl font-bold mb-2">{selectedSeal.title}</h2>
            <p className="text-sm text-[#7A5A3A] mb-6">Par @{selectedSeal.author} le {new Date(selectedSeal.timestamp).toLocaleDateString('fr-FR')}</p>
            
            {selectedSeal.description && <p className="italic text-lg mb-6 border-l-4 border-[#E76F51] pl-4">{selectedSeal.description}</p>}
            
            <div className="bg-[#FDF8F0] p-4 rounded-xl border border-[#EFE0CA] mb-6">
              <p className="text-xs font-mono font-bold text-[#A89070] mb-1">Empreinte SHA-256</p>
              <p className="text-xs font-mono break-all text-[#2C1810]">{selectedSeal.hash}</p>
            </div>

            <div className="flex gap-4 mb-8">
              <button onClick={() => handleLike(selectedSeal.id)} className="flex-1 bg-[#E76F51] text-white py-2 rounded-xl font-bold">❤️ J'aime ({selectedSeal.likes_count})</button>
              <button onClick={() => copyLink(selectedSeal.id)} className="flex-1 bg-[#2C1810] text-white py-2 rounded-xl font-bold">🔗 Copier le lien</button>
            </div>

            <h3 className="font-bold mb-2">Commentaires ({selectedSeal.comments_count})</h3>
            <div className="flex gap-2 mb-4">
              <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Ajouter un commentaire..." className="flex-1 border-2 border-[#EFE0CA] p-2 rounded-xl text-sm outline-none" />
              <button onClick={handleComment} className="bg-[#F4A261] text-white px-4 py-2 rounded-xl font-bold text-sm">Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
