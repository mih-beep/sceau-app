'use client';
import { useEffect, useState } from 'react';

export default function Messages() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [myHandle, setMyHandle] = useState('');
  const [activeContact, setActiveContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // État pour les pactes
  const [showPactModal, setShowPactModal] = useState(false);
  const [pactTitle, setPactTitle] = useState('');
  const [pactDesc, setPactDesc] = useState('');
  const [activePact, setActivePact] = useState<any>(null);

  useEffect(() => {
    setMyHandle(localStorage.getItem('sceau_handle') || '');
    fetch('/api/messages').then(r => r.json()).then(d => setContacts(d.contacts || []));
  }, []);

  async function loadChat(contact: any) {
    setActiveContact(contact);
    const res = await fetch(`/api/messages/${contact.handle}?me=${myHandle}`);
    const data = await res.json();
    setMessages(data.messages || []);
  }

  async function sendMessage() {
    if (!newMessage || !activeContact) return;
    await fetch('/api/messages', { method: 'POST', body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeContact.handle, content: newMessage }) });
    setNewMessage('');
    loadChat(activeContact);
  }

  async function createPact() {
    if (!pactTitle) return;
    const pubkey = localStorage.getItem('sceau_pubkey');
    const res = await fetch('/api/pacts/create', { method: 'POST', body: JSON.stringify({ title: pactTitle, description: pactDesc, pubkey }) });
    const data = await res.json();
    
    // On envoie le pacte dans le chat
    await fetch('/api/messages', { method: 'POST', body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeContact.handle, content: `[PACTE]${data.id}|${pactTitle}` }) });
    
    setShowPactModal(false);
    setPactTitle(''); setPactDesc('');
    loadChat(activeContact);
  }

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-140px)] flex gap-4 font-serif max-w-5xl mx-auto">
      
      {/* LISTE CONTACTS (Responsive : caché si chat ouvert sur mobile) */}
      <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 overflow-y-auto ${activeContact ? 'hidden md:block md:w-1/3' : 'w-full md:w-1/3'}`}>
        <h1 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Messages</h1>
        <div className="space-y-2">
          {contacts.filter(c => c.handle !== myHandle).map(c => (
            <div key={c.id} onClick={() => loadChat(c)} className="p-3 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold text-sm">{c.handle[0].toUpperCase()}</div>
              <div className="font-bold text-sm" style={{color: 'var(--text-main)'}}>@{c.handle}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT (Responsive : prend toute la place sur mobile) */}
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
              // SI LE MESSAGE EST UN PACTE
              if (m.content.startsWith('[PACTE]')) {
                const [id, title] = m.content.replace('[PACTE]', '').split('|');
                return (
                  <div key={i} className="bg-[var(--bg-main)] border-2 border-[#E76F51] p-4 rounded-xl text-center">
                    <div className="font-bold text-lg" style={{color: 'var(--text-main)'}}>🤝 {title}</div>
                    <button onClick={() => setActivePact(id)} className="mt-2 bg-[#E76F51] text-white px-4 py-2 rounded-lg text-xs font-bold">Voir / Signer le Pacte</button>
                  </div>
                );
              }
              // SINON MESSAGE CLASSIQUE
              return (
                <div key={i} className={`max-w-[80%] p-3 rounded-xl text-sm ${m.sender === myHandle ? 'bg-[#E76F51] text-white ml-auto rounded-br-none' : 'bg-[var(--bg-main)] border border-[var(--border-color)] rounded-bl-none'}`} style={{color: m.sender === myHandle ? '#FFF' : 'var(--text-main)'}}>
                  {m.content}
                </div>
              );
            })}
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

      {/* MODALE DE CRÉATION DE PACTE */}
      {showPactModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Créer un Pacte</h2>
            <input type="text" placeholder="Titre de l'accord" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={pactTitle} onChange={e => setPactTitle(e.target.value)} />
            <textarea placeholder="Détails du contrat..." className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={pactDesc} onChange={e => setPactDesc(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowPactModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createPact} className="flex-1 bg-[#E76F51] text-white py-2 rounded-xl font-bold">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE SIGNATURE DE PACTE */}
      {activePact && <PactModal pactId={activePact} onClose={() => setActivePact(null)} />}
    </div>
  );
}

// Composant pour afficher et signer un pacte
import { useEffect as useEffectPact } from 'react';
function PactModal({ pactId, onClose }: { pactId: string, onClose: () => void }) {
  const [pact, setPact] = useState<any>(null);
  
  const loadPact = () => fetch(`/api/pacts/${pactId}`).then(r => r.json()).then(d => setPact(d));
  useEffectPact(() => { loadPact(); }, [pactId]);

  async function signPact() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    await fetch('/api/pacts/sign', { method: 'POST', body: JSON.stringify({ pact_id: pactId, pubkey }) });
    loadPact();
  }

  if (!pact) return null;
  const myHandle = localStorage.getItem('sceau_handle');
  const hasSigned = pact.signataires.includes(myHandle);

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-8 border-2 border-[#E76F51]">
        <h2 className="text-3xl font-bold mb-2 text-center" style={{color: 'var(--text-main)'}}>{pact.title}</h2>
        <p className="text-center text-sm mb-6 text-[var(--text-muted)]">Créé par @{pact.creator}</p>
        <p className="italic mb-8 p-4 bg-[var(--bg-main)] rounded-xl" style={{color: 'var(--text-main)'}}>{pact.description}</p>
        
        <div className="mb-8">
          <h3 className="font-bold mb-2" style={{color: 'var(--text-main)'}}>Signatures :</h3>
          <div className="flex flex-wrap gap-2">
            {pact.signataires.map((s: string) => (
              <span key={s} className="bg-[#F5F9EE] text-[#5D7A3A] border border-[#A8C77E] px-3 py-1 rounded-lg text-sm font-bold">✅ @{s}</span>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 font-bold opacity-50" style={{color: 'var(--text-main)'}}>Fermer</button>
          {!hasSigned && <button onClick={signPact} className="flex-1 bg-[#E76F51] text-white py-3 rounded-xl font-bold">✍️ Contresigner</button>}
        </div>
      </div>
    </div>
  );
}
