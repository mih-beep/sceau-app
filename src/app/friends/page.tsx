'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Friends() {
  // État pour basculer entre "Amis" et "Défis"
  const [activeTab, setActiveTab] = useState<'network' | 'challenges'>('network');

  // États pour les Amis
  const [friendsData, setFriendsData] = useState<any>({ friends: [], received: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState('');
  
  // États pour les Défis
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDesc, setChallengeDesc] = useState('');
  const [challengeAnon, setChallengeAnon] = useState(false);

  const [myHandle, setMyHandle] = useState<string | null>(null);

  useEffect(() => {
    const h = localStorage.getItem('sceau_handle');
    setMyHandle(h ? h.replace('@', '') : null);
  }, []);

  // --- LOGIQUE AMIS ---
  const loadFriends = () => {
    if (!myHandle) return;
    setFriendsLoading(true);
    fetch(`/api/friends?me=${myHandle}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Erreur de chargement');
        return d;
      })
      .then(d => { 
        setFriendsData({ friends: d.friends || [], received: d.received || [] }); 
        setFriendsLoading(false);
      })
      .catch((err) => { 
        setFriendsError(err.message); 
        setFriendsLoading(false); 
      });
  };

  useEffect(() => { 
    if (myHandle && activeTab === 'network') loadFriends(); 
  }, [myHandle, activeTab]);

  useEffect(() => {
    if (!searchQuery.trim() || !myHandle) { setSearchResults([]); return; }
    const delay = setTimeout(() => {
      fetch(`/api/friends?me=${myHandle}&search=${searchQuery}`)
        .then(r => r.json())
        .then(d => setSearchResults(d.searchResults || []))
        .catch(() => {});
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery, myHandle]);

  async function respond(target: string, action: string) {
    await fetch('/api/friends/respond', { method: 'POST', body: JSON.stringify({ me: myHandle, target, action }) });
    loadFriends();
  }

  async function addFriend(target: string) {
    await fetch('/api/friends', { method: 'POST', body: JSON.stringify({ me: myHandle, target }) });
    alert(`Demande envoyée à @${target}`);
    setSearchQuery('');
  }

  // --- LOGIQUE DÉFIS ---
  const loadChallenges = () => {
    setChallengesLoading(true);
    fetch('/api/challenges/list')
      .then(r => r.json())
      .then(d => {
        setChallenges(d.challenges || []);
        setChallengesLoading(false);
      })
      .catch(() => setChallengesLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'challenges') loadChallenges();
  }, [activeTab]);

  async function createChallenge() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert("Connecte-toi !");
    if (!challengeTitle) return alert("Titre requis");

    const res = await fetch('/api/challenges/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: challengeTitle, description: challengeDesc, pubkey, is_anonymous: challengeAnon })
    });
    if (res.ok) {
      setShowChallengeModal(false); 
      setChallengeTitle(''); 
      setChallengeDesc(''); 
      loadChallenges();
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto font-serif min-h-screen">
      
      {/* EN-TÊTE ET BOUTONS DE NAVIGATION */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Mon Cercle.</h1>
        
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('network')} 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'network' ? 'bg-[#F0F6FC] text-[#2D6A9E] shadow' : 'opacity-50'}`}
          >
            👥 Le Réseau
          </button>
          <button 
            onClick={() => setActiveTab('challenges')} 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'challenges' ? 'bg-[#FCEAD6] text-[#C44A2E] shadow' : 'opacity-50'}`}
          >
            🏆 Les Défis
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* CONTENU : RÉSEAU (AMIS) */}
      {/* ========================================== */}
      {activeTab === 'network' && (
        <div className="animate-fade-in">
          {friendsError ? (
            <div className="text-center p-10 font-mono">
              <p className="text-red-500 font-bold mb-4">❌ {friendsError}</p>
              <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="bg-[#2C1810] text-white px-6 py-2 rounded-xl font-bold">Se reconnecter</button>
            </div>
          ) : (
            <>
              <div className="mb-8 relative">
                <input 
                  type="text" 
                  placeholder="🔍 Chercher un créateur par pseudo..." 
                  className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl outline-none bg-[var(--bg-surface)]"
                  style={{color: 'var(--text-main)'}}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg absolute w-full z-10">
                    {searchResults.map(u => (
                      <div key={u.handle} className="flex justify-between items-center p-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-main)]">
                        <div>
                          <Link href={`/u/${u.handle}`} className="font-bold hover:underline" style={{color: 'var(--text-main)'}}>@{u.handle}</Link>
                          <span className="text-xs text-[var(--text-muted)] ml-2">{u.role}</span>
                        </div>
                        <button onClick={() => addFriend(u.handle)} className="bg-[#E76F51] text-white px-3 py-1 rounded-lg text-xs font-bold">+ Ajouter</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {friendsData.received.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-[#E76F51] mb-3">Demandes en attente ({friendsData.received.length})</h2>
                  <div className="space-y-2">
                    {friendsData.received.map((r: any) => (
                      <div key={r.handle} className="bg-[#FDF4F0] p-3 rounded-xl border border-[#FCE0D6] flex justify-between items-center">
                        <Link href={`/u/${r.handle}`} className="font-bold hover:underline" style={{color: 'var(--text-main)'}}>@{r.handle}</Link>
                        <div className="flex gap-2">
                          <button onClick={() => respond(r.handle, 'accept')} className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Accepter</button>
                          <button onClick={() => respond(r.handle, 'reject')} className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Refuser</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="text-lg font-bold mb-3">Mes Amis ({friendsData.friends.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {friendsData.friends.map((f: any) => (
                  <div key={f.handle} className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <Link href={`/u/${f.handle}`} className="font-bold hover:underline" style={{color: 'var(--text-main)'}}>@{f.handle}</Link>
                      <span className="text-xs bg-[#F5F9EE] text-[#5D7A3A] px-2 py-1 rounded">Ami</span>
                    </div>
                    {f.last_seal ? (
                      <Link href={`/o/${f.last_seal_id}`} className="block text-xs text-[var(--text-muted)] bg-[var(--bg-main)] p-2 rounded border border-[var(--border-color)] hover:border-[#E76F51] transition">
                        Dernière œuvre : <span className="font-bold" style={{color: 'var(--text-main)'}}>"{f.last_seal}"</span>
                      </Link>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] italic">Aucune œuvre publique récente.</p>
                    )}
                  </div>
                ))}
                {friendsData.friends.length === 0 && <p className="text-sm text-[var(--text-muted)] italic col-span-2 text-center py-4">Ton cercle est vide. Cherche des créateurs ci-dessus !</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* CONTENU : DÉFIS */}
      {/* ========================================== */}
      {activeTab === 'challenges' && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-[var(--text-muted)] italic">Lancez des duels de créativité, votez pour le meilleur.</p>
            <button onClick={() => setShowChallengeModal(true)} className="bg-[#E76F51] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md whitespace-nowrap">+ Créer un défi</button>
          </div>

          {challengesLoading ? <p className="text-center font-mono">Chargement...</p> : (
            <div className="grid gap-4">
              {challenges.map(c => (
                <Link href={`/challenges/${c.id}`} key={c.id} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition block">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>{c.title}</h2>
                    {c.is_anonymous && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Vote à l'aveugle</span>}
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-4">Lancé par @{c.creator}</p>
                  <div className="flex justify-between items-center text-xs font-mono text-[#A89070]">
                    <span>👥 {c.entries_count} participations</span>
                    <span>⏱ Fin le {new Date(c.deadline).toLocaleDateString('fr-FR')}</span>
                  </div>
                </Link>
              ))}
              {challenges.length === 0 && <p className="text-center italic text-[var(--text-muted)]">Aucun défi en cours. Sois le premier à en lancer un !</p>}
            </div>
          )}
        </div>
      )}

      {/* MODALE DE CRÉATION DE DÉFI */}
      {showChallengeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Créer un Défi</h2>
            <input type="text" placeholder="Titre (ex: Meilleur design de l'été)" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={challengeTitle} onChange={e => setChallengeTitle(e.target.value)} />
            <textarea placeholder="Description du défi..." className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={challengeDesc} onChange={e => setChallengeDesc(e.target.value)} />
            <label className="flex items-center gap-3 mb-6 cursor-pointer">
              <input type="checkbox" checked={challengeAnon} onChange={e => setChallengeAnon(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>Cacher les noms (Vote à l'aveugle)</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowChallengeModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createChallenge} className="flex-1 bg-[#E76F51] text-white py-2 rounded-xl font-bold">Lancer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
