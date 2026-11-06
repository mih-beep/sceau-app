'use client';
import { useEffect, useState, useRef } from 'react';

export default function Messages() {
  const [myHandle, setMyHandle] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  
  // État du chat actif : { type: 'dm' | 'group', id: string, name: string }
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // États pour les modales
  const [showPactModal, setShowPactModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [pactTitle, setPactTitle] = useState('');
  const [pactDesc, setPactDesc] = useState('');
  const [pactSignatures, setPactSignatures] = useState(2);
  const [groupName, setGroupName] = useState('');
  const [activePact, setActivePact] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const myPubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  useEffect(() => {
    setMyHandle(localStorage.getItem('sceau_handle') || '');
    fetch('/api/messages').then(r => r.json()).then(d => setContacts(d.contacts || []));
    fetch(`/api/groups/list?me=${localStorage.getItem('sceau_handle')}`).then(r => r.json()).then(d => setGroups(d.groups || []));
  }, []);

  // Charger les messages (toutes les 3 secondes)
  useEffect(() => {
    if (!activeChat || !myHandle) return;
    const load = () => {
      if (activeChat.type === 'dm') {
        fetch(`/api/messages/${activeChat.id}?me=${myHandle}`).then(r => r.json()).then(data => setMessages(data.messages || []));
      } else {
        fetch(`/api/groups/messages?id=${activeChat.id}`).then(r => r.json()).then(data => setMessages(data.messages || []));
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [activeChat, myHandle]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!newMessage.trim() || !activeChat) return;
    const msg = newMessage;
    setNewMessage('');
    setMessages(prev => [...prev, { content: msg, sender: myHandle, created_at: new Date().toISOString() }]);

    if (activeChat.type === 'dm') {
      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeChat.id, content: msg }) });
    } else {
      await fetch('/api/groups/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: activeChat.id, sender_handle: myHandle, content: msg }) });
    }
  }

  async function createGroup() {
    if (!groupName) return;
    const res = await fetch('/api/groups/create', { method: 'POST', body: JSON.stringify({ name: groupName, creator_pubkey: myPubkey }) });
    const data = await res.json();
    if (res.ok) { alert("Groupe créé !"); setShowGroupModal(false); window.location.reload(); }
  }

  async function createPact() {
    if (!pactTitle || !activeChat) return;
    const formData = new FormData();
    formData.append('title', pactTitle);
    formData.append('description', pactDesc);
    formData.append('pubkey', myPubkey!);
    formData.append('required_signatures', pactSignatures.toString());
    
    if (activeChat.type === 'group') {
      formData.append('group_id', activeChat.id);
    }

    const res = await fetch('/api/pacts/create', { method: 'POST', body: formData });
    const data = await res.json();
    
    if (res.ok) {
      if (activeChat.type === 'dm') {
        await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeChat.id, content: `[PACTE]${data.id}|${pactTitle}` }) });
      } else {
        await fetch('/api/groups/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: activeChat.id, sender_handle: myHandle, content: `[PACTE]${data.id}|${pactTitle}` }) });
      }
      setShowPactModal(false); setPactTitle(''); setPactDesc('');
    }
  }

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-140px)] flex gap-4 font-serif max-w-5xl mx-auto">
      
      {/* COLONNE DE GAUCHE (Contacts & Groupes) */}
      <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 overflow-y-auto ${activeChat ? 'hidden md:block md:w-1/3' : 'w-full md:w-1/3'}`}>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>Messages</h1>
          <button onClick={() => setShowGroupModal(true)} className="bg-[#E76F51] text-white text-xs font-bold px-2 py-1 rounded-lg">+ Groupe</button>
        </div>
        
        {/* GROUPES */}
        {groups.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-mono font-bold text-[#A89070] uppercase mb-2">Groupes</h2>
            {groups.map(g => (
              <div key={g.id} onClick={() => setActiveChat({ type: 'group', id: g.id, name: g.name })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#4A90C2] text-white flex items-center justify-center font-bold text-sm">G</div>
                <div className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>{g.name}</div>
                <span className="text-[0.6rem] text-[var(--text-muted)] ml-auto">{g.members_count} mbrs</span>
              </div>
            ))}
          </div>
        )}

        {/* CONTACTS (DM) */}
        <h2 className="text-xs font-mono font-bold text-[#A89070] uppercase mb-2">Messages Privés</h2>
        {contacts.filter(c => c.handle !== myHandle).map(c => (
          <div key={c.id} onClick={() => setActiveChat({ type: 'dm', id: c.handle, name: c.handle })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold text-sm">{c.handle[0].toUpperCase()}</div>
            <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>@{c.handle}</div>
          </div>
        ))}
      </div>

      {/* COLONNE DE DROITE (Chat) */}
      {activeChat ? (
        <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col overflow-hidden w-full md:w-2/3`}>
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChat(null)} className="md:hidden text-xl font-bold" style={{color: 'var(--text-main)'}}>←</button>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{color: 'var(--text-main)'}}>
                {activeChat.type === 'group' ? `👥 ${activeChat.name}` : `@${activeChat.name}`}
              </h2>
            </div>
            <button onClick={() => setShowPactModal(true)} className="bg-[#E76F51] text-white text-xs font-bold px-3 py-1 rounded-lg">+ Pacte</button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m, i) => {
              if (m.content.startsWith('[PACTE]')) {
                const [id, title] = m.content.replace('[PACTE]', '').split('|');
                return (
                  <div key={i} className="bg-[var(--bg-main)] border-2 border-[#E76F51] p-4 rounded-xl text-center my-4">
                    <div className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>🤝 {title}</div>
                    <button onClick={() => setActivePact(id)} className="bg-[#E76F51] text-white px-4 py-2 rounded-lg text-xs font-bold">Voir / Signer le Pacte</button>
                  </div>
                );
              }
              return (
                <div key={i} className={`max-w-[80%] p-3 rounded-xl text-sm ${m.sender === myHandle ? 'bg-[#E76F51] text-white ml-auto rounded-br-none' : 'bg-[var(--bg-main)] border border-[var(--border-color)] rounded-bl-none'}`} style={{color: m.sender === myHandle ? '#FFF' : 'var(--text-main)'}}>
                  {activeChat.type === 'group' && m.sender !== myHandle && <div className="text-[0.6rem] font-bold opacity-70 mb-1">@{m.sender}</div>}
                  {m.content}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[var(--border-color)] flex gap-2">
            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Écrire..." className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none" style={{color: 'var(--text-main)'}} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} className="bg-[#E76F51] text-white px-4 rounded-xl font-bold">→</button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl items-center justify-center text-[var(--text-muted)]">
          Sélectionnez une discussion.
        </div>
      )}

      {/* MODALE CRÉATION GROUPE */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Créer un Groupe</h2>
            <input type="text" placeholder="Nom du groupe (ex: Projet d'école)" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={groupName} onChange={e => setGroupName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createGroup} className="flex-1 bg-[#4A90C2] text-white py-2 rounded-xl font-bold">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CRÉATION PACTE (avec option multi-signatures) */}
      {showPactModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Nouveau Pacte</h2>
            <input type="text" placeholder="Titre de l'accord" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={pactTitle} onChange={e => setPactTitle(e.target.value)} />
            <textarea placeholder="Détails..." className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={pactDesc} onChange={e => setPactDesc(e.target.value)} />
            
            {activeChat.type === 'group' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Signatures requises pour valider</label>
                <input type="number" min="2" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent text-center font-bold text-lg" value={pactSignatures} onChange={e => setPactSignatures(parseInt(e.target.value))} />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowPactModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createPact} className="flex-1 bg-[#E76F51] text-white py-2 rounded-xl font-bold">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE SIGNATURE PACTE */}
      {activePact && <PactModal pactId={activePact} onClose={() => setActivePact(null)} />}
    </div>
  );
}

function PactModal({ pactId, onClose }: { pactId: string, onClose: () => void }) {
  const [pact, setPact] = useState<any>(null);
  const loadPact = () => fetch(`/api/pacts/${pactId}`).then(r => r.json()).then(d => setPact(d));
  useEffect(() => { loadPact(); }, [pactId]);

  async function signPact() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/pacts/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pact_id: pactId, pubkey }) });
    loadPact();
  }

  if (!pact) return null;
  const myHandle = localStorage.getItem('sceau_handle');
  const hasSigned = pact.signataires.includes(myHandle);
  const isSealed = pact.status === 'scelle';

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
      <div className={`bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-8 border-2 ${isSealed ? 'border-[#7A9B5A]' : 'border-[#E76F51]'}`}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>{pact.title}</h2>
          {isSealed && <span className="bg-[#F5F9EE] text-[#5D7A3A] px-2 py-1 rounded text-xs font-bold">🔒 SCELLÉ</span>}
        </div>
        <p className="text-sm mb-4 text-[var(--text-muted)]">Créé par @{pact.creator}</p>
        <p className="italic mb-4 p-4 bg-[var(--bg-main)] rounded-xl" style={{color: 'var(--text-main)'}}>{pact.description}</p>
        
        <div className="mb-6">
          <h3 className="font-bold mb-2 flex justify-between" style={{color: 'var(--text-main)'}}>
            Signatures : <span>{pact.signataires.length} / {pact.required_signatures}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {pact.signataires.map((s: string) => <span key={s} className="bg-[#F5F9EE] text-[#5D7A3A] border border-[#A8C77E] px-3 py-1 rounded-lg text-sm font-bold">✅ @{s}</span>)}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 font-bold opacity-50" style={{color: 'var(--text-main)'}}>Fermer</button>
          {!hasSigned && !isSealed && <button onClick={signPact} className="flex-1 bg-[#E76F51] text-white py-3 rounded-xl font-bold">✍️ Contresigner</button>}
        </div>
      </div>
    </div>
  );
}
