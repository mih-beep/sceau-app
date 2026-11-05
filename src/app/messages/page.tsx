'use client';
import { useEffect, useState, useRef } from 'react';

export default function Messages() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [myHandle, setMyHandle] = useState('');
  const [activeContact, setActiveContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // États pour les pactes
  const [showPactModal, setShowPactModal] = useState(false);
  const [pactTitle, setPactTitle] = useState('');
  const [pactDesc, setPactDesc] = useState('');
  const [pactFile, setPactFile] = useState<File | null>(null);
  const [activePact, setActivePact] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger les contacts au démarrage
  useEffect(() => {
    setMyHandle(localStorage.getItem('sceau_handle') || '');
    fetch('/api/messages').then(r => r.json()).then(d => setContacts(d.contacts || []));
  }, []);

  // Rafraîchissement automatique (toutes les 2 secondes)
  useEffect(() => {
    if (!activeContact || !myHandle) return;
    
    const load = () => {
      fetch(`/api/messages/${activeContact.handle}?me=${myHandle}`)
        .then(r => r.json())
        .then(data => {
          setMessages(data.messages || []);
        });
    };
    
    load(); // Premier chargement immédiat
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [activeContact, myHandle]);

  // Scroll automatique vers le bas quand un nouveau message arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!newMessage.trim() || !activeContact) return;
    
    const msgToSend = newMessage;
    setNewMessage(''); // On vide le champ tout de suite
    
    // MISE À JOUR OPTIMISTE : On l'affiche direct chez soi
    const optimisticMsg = { 
      content: msgToSend, 
      sender: myHandle, 
      created_at: new Date().toISOString() 
    };
    setMessages(prev => [...prev, optimisticMsg]);

    // On envoie au serveur en arrière-plan
    await fetch('/api/messages', { 
      method: 'POST', 
      body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeContact.handle, content: msgToSend }) 
    });
  }

  async function createPact() {
    if (!pactTitle) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    
    const formData = new FormData();
    formData.append('title', pactTitle);
    formData.append('description', pactDesc);
    formData.append('pubkey', pubkey!);
    if (pactFile) formData.append('file', pactFile);

    const res = await fetch('/api/pacts/create', { method: 'POST', body: formData });
    const data = await res.json();
    
    await fetch('/api/messages', { method: 'POST', body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeContact.handle, content: `[PACTE]${data.id}|${pactTitle}` }) });
    
    setShowPactModal(false);
    setPactTitle(''); setPactDesc(''); setPactFile(null);
  }

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-140px)] flex gap-4 font-serif max-w-5xl mx-auto">
      {/* LISTE CONTACTS */}
      <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 overflow-y-auto ${activeContact ? 'hidden md:block md:w-1/3' : 'w-full md:w-1/3'}`}>
        <h1 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Messages</h1>
        <div className="space-y-2">
          {contacts.filter(c => c.handle !== myHandle).map(c => (
            <div key={c.id} onClick={() => setActiveContact(c)} className="p-3 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold text-sm">{c.handle[0].toUpperCase()}</div>
              <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>@{c.handle}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT */}
      {activeContact ? (
        <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col overflow-hidden ${activeContact ? 'w-full md:w-2/3' : 'hidden md:flex'}`}>
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveContact(null)} className="md:hidden text-xl font-bold" style={{color: 'var(--text-main)'}}>←</button>
              <h2 className="text-lg font-bold" style={{color: 'var(--text-main)'}}>@{activeContact.handle}</h2>
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
                  {m.content}
                </div>
              );
            })}
            <div ref={messagesEndRef} /> {/* Ancre pour le scroll */}
          </div>

          <div className="p-4 border-t border-[var(--border-color)] flex gap-2">
            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Écrire..." className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none" style={{color: 'var(--text-main)'}} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} className="bg-[#E76F51] text-white px-4 rounded-xl font-bold">→</button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl items-center justify-center text-[var(--text-muted)]">
          Sélectionnez un contact.
        </div>
      )}

      {/* MODALE CRÉATION PACTE */}
      {showPactModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Créer un Pacte</h2>
            <input type="text" placeholder="Titre de l'accord" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={pactTitle} onChange={e => setPactTitle(e.target.value)} />
            <textarea placeholder="Détails du contrat..." className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={pactDesc} onChange={e => setPactDesc(e.target.value)} />
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">Fichier joint (optionnel)</label>
            <input type="file" className="w-full mb-4 text-sm" onChange={e => setPactFile(e.target.files?.[0] || null)} />
            <div className="flex gap-2">
              <button onClick={() => setShowPactModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createPact} className="flex-1 bg-[#E76F51] text-white py-2 rounded-xl font-bold">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE SIGNATURE PACTE */}
      {activePact && <PactModal pactId={activePact} receiverHandle={activeContact.handle} onClose={() => setActivePact(null)} />}
    </div>
  );
}

function PactModal({ pactId, receiverHandle, onClose }: { pactId: string, receiverHandle: string, onClose: () => void }) {
  const [pact, setPact] = useState<any>(null);
  
  const loadPact = () => fetch(`/api/pacts/${pactId}`).then(r => r.json()).then(d => setPact(d));
  useEffect(() => { loadPact(); }, [pactId]);

  async function signPact() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/pacts/sign', { method: 'POST', body: JSON.stringify({ pact_id: pactId, pubkey, receiver_handle: receiverHandle }) });
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
        
        {pact.file_path && (
          <a href={pact.file_path} target="_blank" className="block text-center bg-[#2C1810] text-white py-2 rounded-xl mb-6 font-bold text-sm">
            📂 Télécharger le document
          </a>
        )}
        
        <div className="mb-6">
          <h3 className="font-bold mb-2" style={{color: 'var(--text-main)'}}>Signatures :</h3>
          <div className="flex flex-wrap gap-2">
            {pact.signataires.map((s: string) => (
              <span key={s} className="bg-[#F5F9EE] text-[#5D7A3A] border border-[#A8C77E] px-3 py-1 rounded-lg text-sm font-bold">✅ @{s}</span>
            ))}
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
