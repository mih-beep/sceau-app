'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sha256 } from '@noble/hashes/sha256';
import { generatePactCertificate } from '@/lib/pdf';
import { encryptForRecipient, decryptFromSender } from '@/lib/crypto';
import QRCode from 'qrcode';

function fireConfetti() {
  const colors = ['#E76F51', '#F4A261', '#E9C46A', '#2A9D8F', '#4A90C2'];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('div');
    el.style.position = 'fixed'; el.style.width = '10px'; el.style.height = '10px';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.left = Math.random() * 100 + 'vw'; el.style.top = '-10px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    el.style.zIndex = '9999'; el.style.pointerEvents = 'none';
    el.style.transition = `transform ${1 + Math.random() * 2}s ease-in, opacity ${1 + Math.random()}s ease-out`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 360}deg)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 3000);
  }
}

function PactMessage({ pactId, onOpen }: { pactId: string, onOpen: (id: string) => void }) {
  const [pact, setPact] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/pacts/${pactId}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erreur');
        return data;
      })
      .then(d => { if (isMounted) { setPact(d); clearTimeout(timeoutId); } })
      .catch(err => { if (isMounted) { setError(err.name === 'AbortError' ? 'Délai dépassé' : err.message); clearTimeout(timeoutId); } });

    return () => { isMounted = false; controller.abort(); clearTimeout(timeoutId); };
  }, [pactId]);

  if (error) return <div className="p-4 bg-[#FDF4F0] rounded-xl text-center text-xs font-mono my-2 border border-[#FCE0D6] text-[#C44A2E]">❌ Impossible de charger le pacte ({error}).</div>;
  if (!pact) return <div className="p-4 bg-[var(--bg-main)] rounded-xl text-center text-xs font-mono my-2 border border-[var(--border-color)]">Chargement du pacte...</div>;

  const isSealed = pact.status === 'scelle';
  const progress = Math.min(100, ((pact.signataires?.length || 0) / pact.required_signatures) * 100);

  return (
    <div className={`w-full max-w-md bg-[var(--bg-surface)] border-2 rounded-xl p-4 my-2 shadow-sm ${isSealed ? 'border-[#E9C46A]' : 'border-[#4A90C2]'}`}>
      <div className="flex justify-between items-start mb-2">
         <div>
           <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-main)' }}>{pact.title}</h3>
           <p className="text-xs text-[var(--text-muted)]">Pacte de @{pact.creator}</p>
         </div>
         {isSealed && <span className="bg-[#E9C46A] text-[#2C1810] px-2 py-1 rounded text-[0.6rem] font-bold uppercase tracking-wider">Scellé</span>}
      </div>
      
      {pact.description && <p className="text-sm mb-3 italic" style={{ color: 'var(--text-main)' }}>"{pact.description}"</p>}

      {pact.media_urls && pact.media_urls.length > 0 && (
        <div className="mb-4 space-y-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Documents joints</p>
          {pact.media_urls.map((url: string, i: number) => (
             <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-[#4A90C2] hover:underline bg-[#F0F6FC] p-2 rounded border border-[#C9D8E8]">
                Pièce jointe {i+1}
             </a>
          ))}
        </div>
      )}

      <div className="mb-4">
         <div className="flex justify-between text-[0.65rem] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
           <span>Signatures</span>
           <span>{pact.signataires?.length || 0} / {pact.required_signatures}</span>
         </div>
         <div className="w-full bg-[var(--border-color)] rounded-full h-1.5 mb-2">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${isSealed ? 'bg-[#E9C46A]' : 'bg-[#4A90C2]'}`} style={{ width: `${progress}%` }}></div>
         </div>
         <div className="flex flex-wrap gap-1">
            {pact.signataires?.map((s: string) => (
              <span key={s} className="bg-[var(--bg-main)] text-[var(--text-main)] text-[0.65rem] px-1.5 py-0.5 rounded border border-[var(--border-color)]">@{s}</span>
            ))}
         </div>
      </div>

      <button onClick={() => onOpen(pactId)} className={`w-full py-2 rounded-lg text-sm font-bold transition ${isSealed ? 'bg-[var(--bg-main)] text-[var(--text-main)] hover:opacity-80' : 'bg-[#4A90C2] text-white hover:bg-[#2D6A9E]'}`}>
        {isSealed ? 'Voir le certificat' : 'Ouvrir / Signer'}
      </button>
    </div>
  );
}

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUser = searchParams.get('user');

  const [myHandle, setMyHandle] = useState('');
  const [myPubkey, setMyPubkey] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [friendHandles, setFriendHandles] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<any[]>([]);

  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [activePact, setActivePact] = useState<string | null>(null);
  const [isSealingChat, setIsSealingChat] = useState(false);
  const [showSharedVault, setShowSharedVault] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  useEffect(() => {
    const handle = localStorage.getItem('sceau_handle') || '';
    const pubkey = localStorage.getItem('sceau_pubkey');
    setMyHandle(handle);
    setMyPubkey(pubkey);

    if (handle) {
      fetch(`/api/messages?me=${handle}`).then(r => r.json()).then(d => setContacts(d.contacts || []));
      fetch(`/api/groups/list?me=${handle}`).then(r => r.json()).then(d => setGroups(d.groups || []));
      fetch(`/api/friends?me=${handle}`).then(r => r.json()).then(d => {
        const handles = new Set<string>((d.friends || []).map((f: any) => f.handle));
        setFriendHandles(handles);
      }).catch(() => {});
    }

    if (targetUser) setActiveChat({ type: 'dm', id: targetUser, name: targetUser });
  }, [targetUser]);

  // Recherche pour l'invitation au groupe
  useEffect(() => {
    if (!memberSearchQuery || memberSearchQuery.length < 2) { setMemberSearchResults([]); return; }
    const delay = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${memberSearchQuery}`);
      const d = await res.json();
      setMemberSearchResults(d.users || []);
    }, 400);
    return () => clearTimeout(delay);
  }, [memberSearchQuery]);

  useEffect(() => {
    if (!activeChat || !myHandle) return;
    const load = () => {
      const endpoint = activeChat.type === 'dm' ? `/api/messages/${activeChat.id}?me=${myHandle}` : `/api/groups/messages?id=${activeChat.id}`;
      fetch(endpoint).then(r => r.json()).then(data => {
        const serverMessages = data.messages || [];
        setMessages(prev => {
          const tempMessages = prev.filter(m => m.isTemp);
          const merged = [...serverMessages];
          tempMessages.forEach(temp => {
            if (!serverMessages.some((sm: any) => sm.content === temp.content && sm.sender === temp.sender)) merged.push(temp);
          });
          return merged;
        });
      });
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [activeChat, myHandle]);

  useEffect(() => { prevMessagesLength.current = 0; }, [activeChat]);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMessagesLength.current = messages.length;
    }
  }, [messages]);

  async function sendMessage() {
    if (!newMessage.trim() || !activeChat) return;
    const msg = newMessage;
    setNewMessage('');
    const tempId = `temp-${Date.now()}`;
    
    setMessages(prev => [...prev, { content: msg, sender: myHandle, created_at: new Date().toISOString(), isTemp: true, id: tempId }]);

    try {
      if (activeChat.type === 'dm') {
        const myPriv = localStorage.getItem('sceau_secret');
        const targetUser = await fetch(`/api/user-profile/${activeChat.id}`).then(r => r.json());
        const theirPub = targetUser.pubkey;
        if (!myPriv || !theirPub) throw new Error("Clés manquantes");
        const { ciphertext, iv } = await encryptForRecipient(msg, myPriv, theirPub);
        await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeChat.id, content: ciphertext, iv }) });
      } else {
        await fetch('/api/groups/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: activeChat.id, sender_handle: myHandle, content: msg }) });
      }
      setTimeout(() => setMessages(prev => prev.filter(m => m.id !== tempId)), 500);
    } catch (e) { console.error(e); }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);

      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        clearInterval(recordingIntervalRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 2 * 1024 * 1024) return alert("Audio trop lourd (max 2 Mo).");
        if (!myPubkey) return;
        const formData = new FormData();
        formData.append('pubkey', myPubkey);
        formData.append('audio', new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }));
        const res = await fetch('/api/messages/upload-audio', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || !data.url) return alert('Erreur upload audio');
        const msg = `[AUDIO]${data.url}`;
        if (activeChat.type === 'dm') {
          await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeChat.id, content: msg, is_audio: true }) });
        } else {
          await fetch('/api/groups/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: activeChat.id, sender_handle: myHandle, content: msg, is_audio: true }) });
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("Impossible d'accéder au micro."); }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  }

  async function sealDiscussion() {
    if (!messages.length || !myPubkey) return;
    const confirm = window.confirm(`Sceller les ${Math.min(messages.length, 50)} derniers messages dans ton Coffre Privé ?`);
    if (!confirm) return;

    setIsSealingChat(true);
    const lastMessages = messages.slice(-50);
    const textToSeal = lastMessages.map(m => `[@${m.sender} - ${new Date(m.created_at).toLocaleString()}]\n${m.content.startsWith('[AUDIO]') ? 'Message vocal' : m.content}`).join('\n\n');

    const hash = sha256(new TextEncoder().encode(textToSeal));
    let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);

    const formData = new FormData();
    formData.append('hash', btoa(hashStr));
    formData.append('title', `Discussion avec ${activeChat.name} — ${new Date().toLocaleDateString('fr-FR')}`);
    formData.append('description', textToSeal);
    formData.append('pubkey', myPubkey);
    formData.append('visibility', 'private');
    formData.append('isHosted', 'false');

    const res = await fetch('/api/seal', { method: 'POST', body: formData });
    if (res.ok) alert("✅ Discussion scellée ! Retrouve-la dans ton Coffre Privé.");
    else alert("Erreur lors du scellement.");
    setIsSealingChat(false);
  }

  async function createGroup() {
    if (!groupName || !myPubkey) return;
    const res = await fetch('/api/groups/create', { method: 'POST', body: JSON.stringify({ name: groupName, creator_pubkey: myPubkey }) });
    if (res.ok) { alert("Groupe créé !"); setShowGroupModal(false); window.location.reload(); }
  }

  async function addFriend(targetHandle: string) {
    await fetch('/api/friends', { method: 'POST', body: JSON.stringify({ me: myHandle, target: targetHandle }) });
    alert(`Demande d'ami envoyée à @${targetHandle} !`);
  }

  async function addMemberToGroup(targetHandle: string) {
    if (!myPubkey || !activeChat) return;
    const res = await fetch(`/api/groups/${activeChat.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey: myPubkey, targetHandle }) });
    const d = await res.json();
    if (res.ok) { alert('Membre ajouté !'); setMemberSearchQuery(''); setMemberSearchResults([]); }
    else alert(d.error);
  }

  const startPact = () => router.push(`/seal?pact=true&chat_id=${activeChat.id}&chat_type=${activeChat.type}`);

  const getHandleColor = (handle: string) => {
    if (handle === myHandle) return 'var(--text-main)';
    return friendHandles.has(handle) ? '#4A90C2' : '#C75A22';
  };

  const sharedPacts = Array.from(
    new Map(messages.filter(m => m.content.startsWith('[PACTE]')).map(m => {
          const [id, title] = m.content.replace('[PACTE]', '').split('|');
          return [id, { id, title }];
    })).values()
  );

  const activeContacts = contacts.filter(c => c.has_chat);
  const suggestions = contacts.filter(c => !c.has_chat);

  return (
    <div className="p-4 md:p-6 flex gap-4 font-serif w-full max-w-5xl md:max-w-none mx-auto relative h-full">
      {/* LISTE */}
      <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 overflow-y-auto ${activeChat ? 'hidden md:block md:w-1/3' : 'w-full md:w-1/3'}`}>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>Messages</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowSearch(!showSearch)} className="bg-[var(--bg-main)] border text-xs font-bold px-2 py-1 rounded-lg">🔍</button>
            <button onClick={() => setShowGroupModal(true)} className="bg-[var(--bg-main)] border text-xs font-bold px-2 py-1 rounded-lg">Groupe</button>
            <button onClick={() => setActiveChat({ type: 'dm', id: 'nouveau', name: 'Nouveau contact' })} className="bg-[#1A1513] text-white text-xs font-bold px-2 py-1 rounded-lg">+ Pacte</button>
          </div>
        </div>

        {showSearch && (
          <div className="mb-4">
            <input type="text" placeholder="Chercher un pseudo..." className="w-full border p-2 rounded-lg bg-[var(--bg-main)] text-sm mb-2" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchResults.map(u => (
              <div key={u.handle} className="flex justify-between items-center p-2 bg-[var(--bg-surface)] border rounded-lg mb-1">
                <span className="font-bold text-sm cursor-pointer hover:underline" onClick={() => { setActiveChat({type:'dm', id:u.handle, name:u.handle}); setShowSearch(false); setSearchQuery(''); }}>@{u.handle}</span>
                <button onClick={() => addFriend(u.handle)} className="text-[0.65rem] bg-[#E76F51] text-white px-2 py-1 rounded font-bold">+ Ami</button>
              </div>
            ))}
          </div>
        )}

        {groups.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-mono font-bold text-[var(--text-muted)] mb-2">Groupes</h2>
            {groups.map(g => (
              <div key={g.id} onClick={() => setActiveChat({ type: 'group', id: g.id, name: g.name })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#2C1810] text-white flex items-center justify-center font-bold text-sm">G</div>
                <div className="font-bold text-sm truncate" style={{ color: 'var(--text-main)' }}>{g.name}</div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xs font-mono font-bold text-[var(--text-muted)] mb-2">Discussions</h2>
        {activeContacts.map(c => (
          <div key={c.id} onClick={() => setActiveChat({ type: 'dm', id: c.handle, name: c.handle })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: friendHandles.has(c.handle) ? '#4A90C2' : '#C75A22' }}>{c.handle[0].toUpperCase()}</div>
            <div className="font-bold text-sm" style={{color: friendHandles.has(c.handle) ? '#4A90C2' : '#C75A22'}}>@{c.handle}</div>
          </div>
        ))}
      </div>

      {/* CHAT */}
      {activeChat ? (
        <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col overflow-hidden w-full md:w-2/3 relative`}>
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChat(null)} className="md:hidden text-xl font-bold">←</button>
              <h2 className="text-lg font-bold" style={{color: 'var(--text-main)'}}>{activeChat.type === 'group' ? `👥 ${activeChat.name}` : `@${activeChat.name}`}</h2>
            </div>
            <div className="flex gap-2">
              {activeChat.type === 'group' && (
                <button onClick={() => setShowAddMemberModal(true)} className="bg-[#4A90C2] text-white text-xs font-bold px-3 py-1 rounded-lg">+ Ajouter</button>
              )}
              <button onClick={() => setShowSharedVault(true)} className="bg-[var(--bg-main)] border text-xs font-bold px-3 py-1 rounded-lg">Coffre</button>
              <button onClick={sealDiscussion} disabled={isSealingChat} className="bg-[var(--bg-main)] border text-xs font-bold px-3 py-1 rounded-lg">{isSealingChat ? '...' : 'Sceller'}</button>
              <button onClick={startPact} className="bg-[#4A90C2] text-white text-xs font-bold px-3 py-1 rounded-lg">+ Pacte</button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m, i) => {
              if (m.content.startsWith('[PACTE]')) {
                const [id] = m.content.replace('[PACTE]', '').split('|');
                return <PactMessage key={i} pactId={id} onOpen={setActivePact} />;
              }
              return <DecryptedMessage key={i} message={m} myHandle={myHandle} activeChat={activeChat} getHandleColor={getHandleColor} />;
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[var(--border-color)] flex gap-2 items-center">
            <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-xl font-bold text-xl ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--bg-main)] border'}`}>
              {isRecording ? `${recordingTime}s` : 'M'}
            </button>
            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Écrire..." className="flex-1 bg-[var(--bg-main)] border rounded-xl px-4 py-2 text-sm outline-none" onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} className="bg-[#E76F51] text-white px-4 py-2 rounded-xl font-bold">Envoyer</button>
          </div>

          {showSharedVault && (
            <div className="absolute inset-0 bg-[var(--bg-surface)] z-20 flex flex-col rounded-2xl">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg">Coffre Partagé</h3>
                <button onClick={() => setShowSharedVault(false)} className="text-xl opacity-50">✕</button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {sharedPacts.map(p => (
                  <div key={p.id} onClick={() => { setShowSharedVault(false); setActivePact(p.id); }} className="bg-[var(--bg-main)] border p-4 rounded-xl cursor-pointer hover:border-[#E76F51] mb-2">
                    <div className="font-bold">{p.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 bg-[var(--bg-surface)] border rounded-2xl items-center justify-center text-[var(--text-muted)]">Sélectionnez une discussion.</div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4">Créer un Groupe</h2>
            <input type="text" placeholder="Nom du groupe" className="w-full border p-3 rounded-xl mb-4" value={groupName} onChange={e => setGroupName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createGroup} className="flex-1 bg-[#4A90C2] text-white py-2 rounded-xl font-bold">Créer</button>
            </div>
          </div>
        </div>
      )}

      {activePact && <PactModal pactId={activePact} onClose={() => setActivePact(null)} />}

      {showAddMemberModal && activeChat && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-3xl p-6 flex flex-col max-h-[80vh]">
            <h2 className="text-xl font-bold mb-4">Ajouter un membre</h2>
            <input type="text" placeholder="Chercher un pseudo..." className="w-full border p-3 rounded-xl mb-4" value={memberSearchQuery} onChange={e => setMemberSearchQuery(e.target.value)} />
            <div className="flex-1 overflow-y-auto mb-4">
              {memberSearchResults.map(u => (
                <div key={u.handle} className="flex justify-between items-center p-2 border-b">
                  <span className="font-bold text-sm">@{u.handle}</span>
                  <button onClick={() => addMemberToGroup(u.handle)} className="bg-[#4A90C2] text-white px-3 py-1 rounded-lg text-xs font-bold">Ajouter</button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAddMemberModal(false)} className="w-full py-2 rounded-lg bg-[var(--bg-main)] font-bold">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DecryptedMessage({ message, myHandle, activeChat, getHandleColor }: any) {
  const [decrypted, setDecrypted] = useState<string>('🔒 Déchiffrement...');

  useEffect(() => {
    let isMounted = true;
    if (message.isTemp) { setDecrypted(message.content); return; }
    if (message.iv && message.content) {
      const myPriv = localStorage.getItem('sceau_secret');
      const otherHandle = message.sender === myHandle ? activeChat.id : message.sender;
      fetch(`/api/user-profile/${otherHandle}`).then(r => r.json()).then(d => {
        if (d.pubkey && myPriv) {
          decryptFromSender(message.content, message.iv, myPriv, d.pubkey).then(txt => { if (isMounted) setDecrypted(txt); });
        } else { setDecrypted('🔒 Clé introuvable'); }
      }).catch(() => setDecrypted('🔒 Erreur de clé'));
    } else { setDecrypted(message.content); }
    return () => { isMounted = false; };
  }, [message, activeChat]);

  const isAudio = decrypted.startsWith('[AUDIO]');
  const audioSrc = isAudio ? decrypted.replace('[AUDIO]', '') : null;

  return (
    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${message.sender === myHandle ? 'bg-[#E76F51] text-white ml-auto rounded-br-none' : 'bg-[var(--bg-main)] border border-[var(--border-color)] rounded-bl-none'} ${message.isTemp ? 'opacity-60' : ''}`}>
      {activeChat.type === 'group' && message.sender !== myHandle && (
        <div className="text-[0.6rem] font-bold mb-1" style={{ color: getHandleColor(message.sender) }}>@{message.sender}</div>
      )}
      {isAudio ? <audio controls src={audioSrc!} className="h-10 w-56" /> : decrypted}
    </div>
  );
}

function PactModal({ pactId, onClose }: { pactId: string; onClose: () => void }) {
  const [pact, setPact] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [justSealed, setJustSealed] = useState(false);
  
  const loadPact = () => fetch(`/api/pacts/${pactId}`).then(r => r.json()).then(d => setPact(d));
  useEffect(() => { loadPact(); }, [pactId]);

  async function signPact() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return alert("Connecte-toi.");
    setIsSigning(true);
    const res = await fetch('/api/pacts/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pact_id: pactId, pubkey }) });
    const data = await res.json();
    if (data.success) {
      if (data.isNowSealed) { fireConfetti(); setJustSealed(true); }
      loadPact();
    } else { alert(data.error); }
    setIsSigning(false);
  }

  async function downloadCertificate() {
    if (!pact) return;
    setIsDownloading(true);
    const verifyUrl = `${window.location.origin}/o/${pact.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 1 });
    generatePactCertificate(pact.title, pact.description, pact.creator, pact.signataires || [], pact.hash_str || 'Hash en cours', qrDataUrl, pact.id);
    setIsDownloading(false);
  }

  if (!pact) return null;
  const myHandle = localStorage.getItem('sceau_handle');
  const hasSigned = pact.signataires?.includes(myHandle);
  const isSealed = pact.status === 'scelle';

  if (justSealed) {
    return (
      <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
        <div className="bg-[#FDF8F0] w-full max-w-md rounded-3xl p-8 border-4 border-[#E9C46A] shadow-2xl relative text-center">
           <div className="text-6xl mb-4">🏆</div>
           <h2 className="text-3xl font-serif font-bold text-[#2C1810] mb-2">Pacte Scellé !</h2>
           <p className="text-sm text-gray-600 mb-6">L'empreinte de ce contrat a été gravée sur Bitcoin pour l'éternité.</p>
           <div className="space-y-3">
             <a href={`/api/pacts/${pact.id}/ots`} download className="w-full block bg-[#5D7A3A] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#4A6330] transition">Télécharger la preuve .ots</a>
             <button onClick={downloadCertificate} disabled={isDownloading} className="w-full bg-[#E9C46A] text-[#2C1810] py-3 rounded-xl font-bold shadow-md hover:bg-[#F4D03F] transition">{isDownloading ? 'Génération...' : 'Télécharger le Certificat PDF'}</button>
             <button onClick={onClose} className="w-full py-2 font-bold text-gray-500 hover:text-gray-800 transition">Fermer</button>
           </div>
        </div>
      </div>
    );
  }

  const progress = Math.min(100, ((pact.signataires?.length || 0) / pact.required_signatures) * 100);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className={`bg-white w-full max-w-lg rounded-2xl border shadow-2xl relative max-h-[90vh] overflow-y-auto ${isSealed ? 'border-[#E9C46A]' : 'border-[#E5E5E5]'}`}>
        {isSealed && (
          <div className="absolute top-0 left-0 w-full bg-[#E9C46A] text-[#2C1810] py-1.5 rounded-t-2xl text-center text-xs font-bold tracking-widest uppercase">Contrat Scellé sur Bitcoin</div>
        )}
        <div className={`p-6 ${isSealed ? 'mt-6' : ''}`}>
          <div className="mb-6">
            <h2 className="text-2xl font-serif font-bold text-gray-900 leading-tight">{pact.title}</h2>
            <p className="text-xs font-mono text-gray-500 mt-1">Proposé par @{pact.creator}</p>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm text-gray-700 italic bg-gray-50 p-3 rounded-lg border border-gray-100">"{pact.description || 'Aucune description fournie.'}"</p>
          </div>

          {pact.media_urls && pact.media_urls.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Documents du contrat</h3>
              <div className="space-y-2">
                {pact.media_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm font-medium text-gray-700 hover:text-black bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-400 transition">
                    <span>Document {i + 1}</span>
                    <span className="text-xs text-blue-600 font-bold">Consulter</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
              <span>Signatures ({pact.signataires?.length || 0} / {pact.required_signatures})</span>
              {isSealed && <span className="text-green-600 uppercase tracking-wide">Validé</span>}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
              <div className={`h-1.5 rounded-full transition-all duration-700 ${isSealed ? 'bg-[#E9C46A]' : 'bg-black'}`} style={{ width: `${progress}%` }}></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(pact.signataires || []).map((s: string) => (
                <span key={s} className="bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-md text-xs font-medium">@{s}</span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {isSealed ? (
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-center mb-2">
                <p className="text-[0.65rem] text-gray-500 font-bold uppercase mb-1">Empreinte SHA-256</p>
                <p className="text-[0.6rem] font-mono text-gray-800 break-all">{pact.hash_str}</p>
              </div>
            ) : (
              <button onClick={signPact} disabled={hasSigned || isSigning} className={`w-full py-3.5 rounded-xl font-bold text-white transition ${hasSigned ? 'bg-green-600 cursor-default' : 'bg-black hover:bg-gray-800'}`}>
                {isSigning ? 'Ancrage en cours...' : hasSigned ? 'Vous avez signé' : 'Contresigner le contrat'}
              </button>
            )}
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={downloadCertificate} disabled={isDownloading} className="bg-[#1A1513] text-white py-2 rounded-lg font-bold text-xs hover:bg-black transition">{isDownloading ? '...' : '📄 Certificat PDF'}</button>
              <a href={`/api/pacts/${pact.id}/ots`} download className="bg-[#5D7A3A] text-white py-2 rounded-lg font-bold text-xs hover:bg-[#4A6330] transition text-center flex items-center justify-center">⛓️ Preuve .ots</a>
            </div>

            <button onClick={onClose} className="w-full py-2 text-sm font-bold text-gray-400 hover:text-gray-800 transition">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-mono">Chargement...</div>}>
      <MessagesInner />
    </Suspense>
  );
}
