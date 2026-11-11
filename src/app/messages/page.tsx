'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sha256 } from '@noble/hashes/sha256';
import { generatePactCertificate } from '@/lib/pdf';
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
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout de 8s

    fetch(`/api/pacts/${pactId}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erreur de chargement');
        return data;
      })
      .then(d => {
        if (isMounted) {
          setPact(d);
          clearTimeout(timeoutId);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('[PactMessage] Erreur:', err);
          setError(err.name === 'AbortError' ? 'Délai dépassé' : err.message);
          clearTimeout(timeoutId);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [pactId]);

  if (error) return (
    <div className="p-4 bg-[#FDF4F0] rounded-xl text-center text-xs font-mono my-2 border border-[#FCE0D6] text-[#C44A2E]">
      ❌ Impossible de charger le pacte ({error}).
      <br/>
      <span className="opacity-70 text-[0.65rem]">ID: {pactId}</span>
    </div>
  );

  if (!pact) return (
    <div className="p-4 bg-[var(--bg-main)] rounded-xl text-center text-xs font-mono my-2 border border-[var(--border-color)] flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
      <span className="w-3 h-3 border-2 border-t-transparent border-[var(--text-muted)] rounded-full animate-spin"></span>
      Chargement du pacte...
    </div>
  );

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

      {/* Fichiers */}
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

      {/* Signatures */}
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

  useEffect(() => {
    if (!activeChat || !myHandle) return;
    const load = () => {
      const endpoint = activeChat.type === 'dm'
        ? `/api/messages/${activeChat.id}?me=${myHandle}`
        : `/api/groups/messages?id=${activeChat.id}`;

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
        await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeChat.id, content: msg }) });
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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

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
    formData.append('isFlash', 'false');
    formData.append('isMystery', 'false');

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

  const startPact = () => router.push(`/seal?pact=true&chat_id=${activeChat.id}&chat_type=${activeChat.type}`);

  const getHandleColor = (handle: string) => {
    if (handle === myHandle) return 'var(--text-main)';
    return friendHandles.has(handle) ? '#4A90C2' : '#C75A22';
  };

  const sharedPacts = Array.from(
    new Map(
      messages
        .filter(m => m.content.startsWith('[PACTE]'))
        .map(m => {
          const [id, title] = m.content.replace('[PACTE]', '').split('|');
          return [id, { id, title }];
        })
    ).values()
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
            <button onClick={() => setShowGroupModal(true)} className="bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] text-xs font-bold px-2 py-1 rounded-lg hover:border-[#E76F51] transition">Groupe</button>
            <button onClick={() => setActiveChat({ type: 'dm', id: 'nouveau', name: 'Nouveau contact' })} className="bg-[#1A1513] text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-black transition">+ Pacte</button>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-mono font-bold text-[var(--text-muted)] mb-2">Groupes</h2>
            {groups.map(g => (
              <div key={g.id} onClick={() => setActiveChat({ type: 'group', id: g.id, name: g.name })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#2C1810] text-white flex items-center justify-center font-bold text-sm">G</div>
                <div className="font-bold text-sm truncate" style={{ color: 'var(--text-main)' }}>{g.name}</div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xs font-mono font-bold text-[var(--text-muted)] mb-2">Discussions</h2>
        {activeContacts.map(c => {
          const isFriend = friendHandles.has(c.handle);
          return (
            <div key={c.id} onClick={() => setActiveChat({ type: 'dm', id: c.handle, name: c.handle })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: isFriend ? '#4A90C2' : '#C75A22' }}>
                {c.handle[0].toUpperCase()}
              </div>
              <div className="font-bold text-sm" style={{color: isFriend ? '#4A90C2' : '#C75A22'}}>@{c.handle}</div>
            </div>
          );
        })}
        {activeContacts.length === 0 && <p className="text-xs text-[var(--text-muted)] italic mb-4">Aucune discussion active.</p>}

        <div className="mt-6 border-t border-[var(--border-color)] pt-4">
          <h2 className="text-xs font-mono font-bold text-[var(--text-muted)] mb-2">Suggestions</h2>
          {suggestions.length > 0 ? (
            suggestions.map(c => (
              <div key={c.id} onClick={() => setActiveChat({ type: 'dm', id: c.handle, name: c.handle })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1 opacity-70 hover:opacity-100">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-[var(--text-muted)] bg-[var(--bg-main)] border border-[var(--border-color)]">
                  {c.handle[0].toUpperCase()}
                </div>
                <div className="font-bold text-sm text-[var(--text-muted)]">@{c.handle}</div>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">Aucune suggestion pour le moment.</p>
          )}
        </div>
      </div>

      {/* CHAT */}
      {activeChat ? (
        <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col overflow-hidden w-full md:w-2/3 relative`}>
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChat(null)} className="md:hidden text-xl font-bold" style={{color: 'var(--text-main)'}}>←</button>
              <h2 className="text-lg font-bold" style={{color: 'var(--text-main)'}}>
                {activeChat.type === 'group' ? `👥 ${activeChat.name}` : `@${activeChat.name}`}
              </h2>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSharedVault(true)} className="bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] text-xs font-bold px-3 py-1 rounded-lg hover:border-[#E76F51] transition">Coffre</button>
              <button onClick={sealDiscussion} disabled={isSealingChat} className="bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] text-xs font-bold px-3 py-1 rounded-lg hover:border-[#E76F51] transition disabled:opacity-50">{isSealingChat ? '...' : 'Sceller'}</button>
              <button onClick={startPact} className="bg-[#4A90C2] text-white text-xs font-bold px-3 py-1 rounded-lg hover:bg-[#2D6A9E] transition">+ Pacte</button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m, i) => {
              if (m.content.startsWith('[PACTE]')) {
                const [id] = m.content.replace('[PACTE]', '').split('|');
                return <PactMessage key={i} pactId={id} onOpen={setActivePact} />;
              }

              const isAudio = m.content.startsWith('[AUDIO]');
              const audioSrc = isAudio ? m.content.replace('[AUDIO]', '') : null;

              return (
                <div key={i} className={`max-w-[80%] p-3 rounded-xl text-sm ${m.sender === myHandle ? 'bg-[#E76F51] text-white ml-auto rounded-br-none' : 'bg-[var(--bg-main)] border border-[var(--border-color)] rounded-bl-none'} ${m.isTemp ? 'opacity-60' : ''}`}>
                  {activeChat.type === 'group' && m.sender !== myHandle && (
                    <div className="text-[0.6rem] font-bold mb-1" style={{ color: getHandleColor(m.sender) }}>@{m.sender}</div>
                  )}
                  {isAudio ? <audio controls src={audioSrc!} className="h-10 w-56" /> : m.content}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[var(--border-color)] flex gap-2 items-center">
            <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-xl font-bold text-xl ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--bg-main)] border border-[var(--border-color)]'}`} style={{ color: isRecording ? 'white' : 'var(--text-main)' }}>
              {isRecording ? `${recordingTime}s` : 'M'}
            </button>
            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Écrire..." className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none focus:border-[#E76F51]" style={{color: 'var(--text-main)'}} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} className="bg-[#E76F51] text-white px-4 py-2 rounded-xl font-bold">Envoyer</button>
          </div>

          {showSharedVault && (
            <div className="absolute inset-0 bg-[var(--bg-surface)] z-20 flex flex-col rounded-2xl">
              <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
                <h3 className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>Coffre Partagé</h3>
                <button onClick={() => setShowSharedVault(false)} className="text-xl opacity-50">✕</button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                <p className="text-xs text-[var(--text-muted)] italic mb-4">Retrouvez ici tous les pactes échangés dans cette discussion.</p>
                {sharedPacts.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-muted)] py-10">Aucun pacte pour le moment.</p>
                ) : (
                  <div className="space-y-3">
                    {sharedPacts.map(p => (
                      <div key={p.id} onClick={() => { setShowSharedVault(false); setActivePact(p.id); }} className="bg-[var(--bg-main)] border border-[var(--border-color)] p-4 rounded-xl cursor-pointer hover:border-[#E76F51] transition">
                        <div className="font-bold" style={{color: 'var(--text-main)'}}>{p.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">Cliquez pour voir les détails et signer</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl items-center justify-center text-[var(--text-muted)]">
          Sélectionnez une discussion.
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Créer un Groupe</h2>
            <input type="text" placeholder="Nom du groupe" className="w-full border border-[var(--border-soft)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={groupName} onChange={e => setGroupName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-2 font-bold opacity-50">Annuler</button>
              <button onClick={createGroup} className="flex-1 bg-[#4A90C2] text-white py-2 rounded-xl font-bold">Créer</button>
            </div>
          </div>
        </div>
      )}

      {activePact && <PactModal pactId={activePact} onClose={() => setActivePact(null)} />}
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
      if (data.isNowSealed) {
        fireConfetti();
        setJustSealed(true);
      }
      loadPact();
    } else {
      alert(data.error);
    }
    setIsSigning(false);
  }

  async function downloadCertificate() {
    if (!pact) return;
    setIsDownloading(true);
    const verifyUrl = `${window.location.origin}/o/${pact.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 1 });
    generatePactCertificate(
      pact.title, pact.description, pact.creator, pact.signataires || [], 
      pact.hash_str || 'Hash en cours de calcul', qrDataUrl, pact.id
    );
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
             <a href={`/api/pacts/${pact.id}/ots`} download className="w-full block bg-[#5D7A3A] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#4A6330] transition">
               Télécharger la preuve .ots
             </a>
             <button onClick={downloadCertificate} disabled={isDownloading} className="w-full bg-[#E9C46A] text-[#2C1810] py-3 rounded-xl font-bold shadow-md hover:bg-[#F4D03F] transition">
               {isDownloading ? 'Génération...' : 'Télécharger le Certificat PDF'}
             </button>
             <button onClick={onClose} className="w-full py-2 font-bold text-gray-500 hover:text-gray-800 transition">
               Fermer
             </button>
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
          <div className="absolute top-0 left-0 w-full bg-[#E9C46A] text-[#2C1810] py-1.5 rounded-t-2xl text-center text-xs font-bold tracking-widest uppercase">
            Contrat Scellé sur Bitcoin
          </div>
        )}

        <div className={`p-6 ${isSealed ? 'mt-6' : ''}`}>
          <div className="mb-6">
            <h2 className="text-2xl font-serif font-bold text-gray-900 leading-tight">{pact.title}</h2>
            <p className="text-xs font-mono text-gray-500 mt-1">Proposé par @{pact.creator}</p>
          </div>

          {pact.description && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 leading-relaxed">"{pact.description}"</p>
            </div>
          )}

          {pact.media_urls && pact.media_urls.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Documents du contrat</h3>
              <div className="space-y-2">
                {pact.media_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm font-medium text-gray-700 hover:text-black bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-400 transition">
                    <span>Document {i + 1}</span>
                    <span className="text-xs text-blue-600 font-bold">Télécharger</span>
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
              <>
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-center mb-2">
                  <p className="text-[0.65rem] text-gray-500 font-bold uppercase mb-1">Empreinte SHA-256</p>
                  <p className="text-[0.6rem] font-mono text-gray-800 break-all">{pact.hash_str}</p>
                </div>
                <button onClick={downloadCertificate} disabled={isDownloading} className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition">
                  {isDownloading ? 'Génération...' : 'Télécharger le Certificat PDF'}
                </button>
                <a href={`/api/pacts/${pact.id}/ots`} download className="w-full block text-center bg-[#5D7A3A] text-white py-3.5 rounded-xl font-bold hover:bg-[#4A6330] transition">
                  Télécharger la preuve .ots
                </a>
              </>
            ) : (
              <button onClick={signPact} disabled={hasSigned || isSigning} className={`w-full py-3.5 rounded-xl font-bold text-white transition ${hasSigned ? 'bg-green-600 cursor-default' : 'bg-black hover:bg-gray-800'}`}>
                {isSigning ? 'Ancrage en cours...' : hasSigned ? 'Vous avez signé' : 'Contresigner le contrat'}
              </button>
            )}
            <button onClick={onClose} className="w-full py-2 text-sm font-bold text-gray-400 hover:text-gray-800 transition">
              Fermer
            </button>
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
