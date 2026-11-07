'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sha256 } from '@noble/hashes/sha256';

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
  const [activePact, setActivePact] = useState<any>(null);
  const [isSealingChat, setIsSealingChat] = useState(false);

  // Audio
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

    fetch('/api/messages').then(r => r.json()).then(d => setContacts(d.contacts || []));
    fetch(`/api/groups/list?me=${handle}`).then(r => r.json()).then(d => setGroups(d.groups || []));

    // Charger les amis pour distinguer vert vs orange
    if (handle) {
      fetch(`/api/friends?me=${handle}`)
        .then(r => r.json())
        .then(d => {
          const handles = new Set<string>((d.friends || []).map((f: any) => f.handle));
          setFriendHandles(handles);
        })
        .catch(() => {});
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

  // === ENREGISTREMENT VOCAL (upload R2, pas base64) ===
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

        if (audioBlob.size > 2 * 1024 * 1024) {
          alert("Audio trop lourd (max ~2 Mo, ~60 secondes). Raccourcis la prochaine fois !");
          return;
        }

        if (!myPubkey) return;

        // Upload dans R2
        const formData = new FormData();
        formData.append('pubkey', myPubkey);
        formData.append('audio', new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }));

        const res = await fetch('/api/messages/upload-audio', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || !data.url) {
          alert('Erreur upload audio : ' + (data.error || 'inconnue'));
          return;
        }

        const msg = `[AUDIO]${data.url}`;
        if (activeChat.type === 'dm') {
          await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_handle: myHandle, receiver_handle: activeChat.id, content: msg, is_audio: true }) });
        } else {
          await fetch('/api/groups/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: activeChat.id, sender_handle: myHandle, content: msg, is_audio: true }) });
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Impossible d'accéder au micro.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  }

  // === SCELLER LA DISCUSSION ===
  async function sealDiscussion() {
    if (!messages.length || !myPubkey) return;

    const confirm = window.confirm(
      `Sceller les ${Math.min(messages.length, 50)} derniers messages dans ton Coffre Privé ?\n\nCela crée une preuve infalsifiable de la conversation avec ${activeChat.name}.`
    );
    if (!confirm) return;

    setIsSealingChat(true);

    const lastMessages = messages.slice(-50);
    const textToSeal = lastMessages
      .map(m => `[@${m.sender} - ${new Date(m.created_at).toLocaleString()}]\n${m.content.startsWith('[AUDIO]') ? 'Message vocal' : m.content}`)
      .join('\n\n');

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
    formData.append('isEphemeral', 'false');

    const res = await fetch('/api/seal', { method: 'POST', body: formData });
    if (res.ok) {
      alert("✅ Discussion scellée ! Retrouve-la dans ton Coffre Privé (Profil → Coffre → Privé).");
    } else {
      const d = await res.json();
      alert("Erreur : " + (d.error || 'inconnue'));
    }
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
    return friendHandles.has(handle) ? '#3F8F5C' : '#C75A22';
  };

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-140px)] flex gap-4 font-serif max-w-5xl mx-auto">

      {/* LISTE */}
      <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 overflow-y-auto ${activeChat ? 'hidden md:block md:w-1/3' : 'w-full md:w-1/3'}`}>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold" style={{color: 'var(--text-main)'}}>Messages</h1>
          <button onClick={() => setShowGroupModal(true)} className="bg-[#E76F51] text-white text-xs font-bold px-2 py-1 rounded-lg">+ Groupe</button>
        </div>

        {groups.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-mono font-bold text-[#A89070] uppercase mb-2">Groupes</h2>
            {groups.map(g => (
              <div key={g.id} onClick={() => setActiveChat({ type: 'group', id: g.id, name: g.name })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-white border border-[var(--border-color)] text-[var(--text-main)] flex items-center justify-center font-bold text-sm">G</div>
                <div className="font-bold text-sm truncate" style={{color: 'var(--text-main)'}}>{g.name}</div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xs font-mono font-bold text-[#A89070] uppercase mb-2">Messages Privés</h2>
        <div className="text-[0.55rem] text-[var(--text-muted)] italic mb-2">
          🟢 Amis · 🟠 Inconnus
        </div>
        {contacts.filter(c => c.handle !== myHandle).map(c => {
          const isFriend = friendHandles.has(c.handle);
          return (
            <div key={c.id} onClick={() => setActiveChat({ type: 'dm', id: c.handle, name: c.handle })} className="p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-main)] transition flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: isFriend ? '#3F8F5C' : '#C75A22' }}>
                {c.handle[0].toUpperCase()}
              </div>
              <div className="font-bold text-sm" style={{color: isFriend ? '#3F8F5C' : '#C75A22'}}>@{c.handle}</div>
            </div>
          );
        })}
      </div>

      {/* CHAT */}
      {activeChat ? (
        <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col overflow-hidden w-full md:w-2/3`}>
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChat(null)} className="md:hidden text-xl font-bold" style={{color: 'var(--text-main)'}}>←</button>
              <h2 className="text-lg font-bold" style={{color: 'var(--text-main)'}}>
                {activeChat.type === 'group' ? `👥 ${activeChat.name}` : `@${activeChat.name}`}
              </h2>
            </div>
            <div className="flex gap-2">
              <button onClick={sealDiscussion} disabled={isSealingChat} className="bg-[#2C1810] text-white text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-50">
                {isSealingChat ? '⏳...' : '🔒 Sceller'}
              </button>
              <button onClick={startPact} className="bg-[#4A90C2] text-white text-xs font-bold px-3 py-1 rounded-lg">+ Pacte</button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m, i) => {
              if (m.content.startsWith('[PACTE]')) {
                const [id, title] = m.content.replace('[PACTE]', '').split('|');
                return (
                  <div key={i} className="bg-[var(--bg-main)] border-2 border-[#4A90C2] p-4 rounded-xl text-center my-4">
                    <div className="font-bold text-lg mb-2" style={{color: 'var(--text-main)'}}>🤝 {title}</div>
                    <button onClick={() => setActivePact(id)} className="bg-[#4A90C2] text-white px-4 py-2 rounded-lg text-xs font-bold">Voir / Signer</button>
                  </div>
                );
              }

              const isAudio = m.content.startsWith('[AUDIO]');
              const audioSrc = isAudio ? m.content.replace('[AUDIO]', '') : null;

              return (
                <div key={i} className={`max-w-[80%] p-3 rounded-xl text-sm ${m.sender === myHandle ? 'bg-[#E76F51] text-white ml-auto rounded-br-none' : 'bg-[var(--bg-main)] border border-[var(--border-color)] rounded-bl-none'} ${m.isTemp ? 'opacity-60' : ''}`}>
                  {activeChat.type === 'group' && m.sender !== myHandle && (
                    <div className="text-[0.6rem] font-bold mb-1" style={{ color: getHandleColor(m.sender) }}>@{m.sender}</div>
                  )}
                  {isAudio ? (
                    <audio controls src={audioSrc!} className="h-10 w-56" />
                  ) : (
                    m.content
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[var(--border-color)] flex gap-2 items-center">
            <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-xl font-bold text-xl ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--bg-main)] text-[var(--text-main)]'}`}>
              {isRecording ? `${recordingTime}s ⏹` : '🎙️'}
            </button>
            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Écrire..." className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none" style={{color: 'var(--text-main)'}} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} className="bg-[#E76F51] text-white px-4 py-2 rounded-xl font-bold">→</button>
          </div>
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
            <input type="text" placeholder="Nom du groupe" className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={groupName} onChange={e => setGroupName(e.target.value)} />
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
  const loadPact = () => fetch(`/api/pacts/${pactId}`).then(r => r.json()).then(d => setPact(d));
  useEffect(() => { loadPact(); }, [pactId]);

  async function signPact() {
    const pubkey = localStorage.getItem('sceau_pubkey');
    const res = await fetch('/api/pacts/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pact_id: pactId, pubkey }) });
    const data = await res.json();
    if (data.success) loadPact();
  }

  if (!pact) return null;
  const myHandle = localStorage.getItem('sceau_handle');
  const hasSigned = pact.signataires?.includes(myHandle);
  const isSealed = pact.status === 'scelle';

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
      <div className={`bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-8 border-2 ${isSealed ? 'border-[#7A9B5A]' : 'border-[#4A90C2]'}`}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-3xl font-bold" style={{color: 'var(--text-main)'}}>{pact.title}</h2>
          {isSealed && <span className="bg-[#F5F9EE] text-[#5D7A3A] px-2 py-1 rounded text-xs font-bold">🔒 SCELLÉ</span>}
        </div>
        <p className="text-sm mb-4 text-[var(--text-muted)]">Proposé par @{pact.creator}</p>
        <p className="italic mb-4 p-3 bg-[var(--bg-main)] rounded-xl text-sm" style={{color: 'var(--text-main)'}}>{pact.description}</p>

        {pact.file_path && (
          <a href={pact.file_path} target="_blank" rel="noopener" className="block bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] p-3 rounded-xl mb-4 text-center font-bold text-sm hover:underline">
            📁 Voir le fichier joint
          </a>
        )}

        <div className="mb-6">
          <h3 className="font-bold mb-2 flex justify-between" style={{color: 'var(--text-main)'}}>
            Signatures : <span>{pact.signataires?.length || 0} / {pact.required_signatures}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {(pact.signataires || []).map((s: string) => (
              <span key={s} className="bg-[#F5F9EE] text-[#5D7A3A] border border-[#A8C77E] px-3 py-1 rounded-lg text-sm font-bold">✅ @{s}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 font-bold opacity-50" style={{color: 'var(--text-main)'}}>Fermer</button>
          {!hasSigned && !isSealed && (
            <button onClick={signPact} className="flex-1 bg-[#4A90C2] text-white py-3 rounded-xl font-bold">✍️ Contresigner</button>
          )}
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
