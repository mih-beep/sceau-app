'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function SealContent() {
  const searchParams = useSearchParams();
  const isPactMode = searchParams.get('pact') === 'true';
  const chatId = searchParams.get('chat_id');
  const chatType = searchParams.get('chat_type');
  const challengeIdParam = searchParams.get('challenge_id');

  const [isFlashMode, setIsFlashMode] = useState(false);
  const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio'>('file');
  
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pactFiles, setPactFiles] = useState<File[]>([]);
  
  const [visibility, setVisibility] = useState('public');
  const [revealAt, setRevealAt] = useState('');
  const [isHosted, setIsHosted] = useState(true);
  const [isMystery, setIsMystery] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [requiredSignatures, setRequiredSignatures] = useState(2);
  
  const [mySeals, setMySeals] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [status, setStatus] = useState('');
  const [sealedResult, setSealedResult] = useState<any>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const p = localStorage.getItem('sceau_pubkey');
    if (!p || isPactMode) return;
    fetch(`/api/profil?pubkey=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(d => {
        const roots = (d.seals || []).filter((x: any) => !x.is_flash && !x.is_ephemeral);
        setMySeals(roots);
      })
      .catch(() => {});
  }, [isPactMode]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setFile(new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }));
        setAudioUrl(URL.createObjectURL(audioBlob));
      };
      mediaRecorder.start(); setIsRecording(true);
    } catch (err) { alert("Impossible d'accéder au micro."); }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  }

  async function handleSeal() {
    if (!title) return setStatus("Un titre est requis");
    if (!isPactMode && mode === 'file' && !file) return setStatus("Choisis un fichier");
    if ((isFlashMode || mode === 'text') && !textContent && !title) return setStatus("Écris quelque chose");
    if (!isFlashMode && mode === 'media' && !file) return setStatus("Prends une photo ou vidéo");
    if (!isFlashMode && mode === 'audio' && !file) return setStatus("Enregistre un audio");

    setStatus(isPactMode ? "Préparation..." : "Calcul de l'empreinte...");
    try {
      let hashContent: Uint8Array;

      if (isPactMode) {
        const metaString = `${title}-${desc}-${pactFiles.map(f => f.name).join(',')}`;
        hashContent = sha256(new TextEncoder().encode(metaString));
      } else if ((isFlashMode && mode === 'text') || mode === 'text') {
        hashContent = sha256(new TextEncoder().encode(textContent || title));
      } else {
        if (!file) return setStatus("Fichier manquant");
        const buffer = await file.arrayBuffer();
        hashContent = sha256(new Uint8Array(buffer));
      }

      let hashStr = ''; for (let i = 0; i < hashContent.length; i++) hashStr += String.fromCharCode(hashContent[i]);
      sendToServer(btoa(hashStr));
    } catch (e) { setStatus("❌ Erreur de gravure"); }
  }

  async function sendToServer(hashB64: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return setStatus("Connecte-toi !");

    const formData = new FormData();
    formData.append('hash', hashB64);
    formData.append('title', title);
    formData.append('description', mode === 'text' ? textContent : desc);
    formData.append('pubkey', pubkey);
    
    let endpoint = '/api/seal';

    if (isPactMode) {
      endpoint = '/api/pacts/create';
      formData.append('group_id', chatType === 'group' ? (chatId as string) : '');
      formData.append('required_signatures', requiredSignatures.toString());
      formData.append('isHosted', 'true');
      pactFiles.forEach(f => formData.append('files', f));
    } else {
      formData.append('isFlash', isFlashMode.toString());
      formData.append('visibility', visibility);
      formData.append('reveal_at', revealAt);
      formData.append('isMystery', isMystery.toString());
      formData.append('isEphemeral', isEphemeral.toString());
      
      if (selectedProjectId) formData.append('project_id', selectedProjectId);
      if (challengeIdParam) formData.append('challenge_id', challengeIdParam);
      
      if (!isFlashMode && file) formData.append('file', file);
      formData.append('isHosted', (!isFlashMode && isHosted).toString());
    }

    setStatus("Ancrage Bitcoin...");
    const res = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await res.json();
    
    if (res.ok) {
      if (isPactMode) {
        const msg = `[PACTE]${data.id}|${data.title}`;
        if (chatType === 'dm') {
          await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_handle: localStorage.getItem('sceau_handle'), receiver_handle: chatId, content: msg }) });
        } else {
          await fetch('/api/groups/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: chatId, sender_handle: localStorage.getItem('sceau_handle'), content: msg }) });
        }
        window.location.href = '/messages';
      } else {
        setStatus("✅ Scellé !");
        setSealedResult({ title, hash: hashB64, date: new Date().toLocaleDateString('fr-FR'), isFlash: isFlashMode });
      }
    } else {
      setStatus("❌ " + data.error);
    }
  }

  if (sealedResult) {
    return (
      <div className="p-6 font-serif text-center flex flex-col items-center">
        <div className="text-6xl mb-4">{sealedResult.isFlash ? '⚡' : '✅'}</div>
        <h1 className="text-3xl font-bold mb-2">C'est gravé.</h1>
        <div className="bg-white p-6 rounded-3xl border w-full max-w-sm text-left shadow-lg mt-6">
          <h3 className="font-bold mb-2">{sealedResult.title}</h3>
          <p className="text-[0.6rem] font-mono break-all bg-gray-50 p-2 rounded">{sealedResult.hash}</p>
          <p className="text-xs text-right mt-3">Scellé le {sealedResult.date}</p>
        </div>
        <button onClick={() => window.location.reload()} className="mt-8 bg-black text-white p-3 rounded-xl font-bold w-full max-w-sm">Nouveau</button>
      </div>
    );
  }

  return (
    <div className="p-6 font-sans max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">{isPactMode ? "Nouveau Pacte." : (isFlashMode ? "Flash." : "L'Atelier.")}</h1>
      </div>

      {!isPactMode && (
        <div className="flex bg-[#F9F6F0] p-1 rounded-xl mb-4">
          <button onClick={() => { setIsFlashMode(false); setMode('file'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm ${!isFlashMode ? 'bg-white shadow' : 'opacity-50'}`}>📁 Normal</button>
          <button onClick={() => { setIsFlashMode(true); setMode('text'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm ${isFlashMode ? 'bg-black text-white shadow' : 'opacity-50'}`}>⚡ Flash</button>
        </div>
      )}

      <div className="space-y-4 bg-white p-6 rounded-2xl border shadow-sm">
        
        <div className="flex bg-[#F9F6F0] p-1 rounded-xl mb-4 text-xs font-mono">
          {!isFlashMode && !isPactMode && <button onClick={() => setMode('file')} className={`flex-1 py-2 rounded-lg font-bold ${mode === 'file' ? 'bg-white shadow' : 'opacity-50'}`}>📁</button>}
          <button onClick={() => setMode('text')} className={`flex-1 py-2 rounded-lg font-bold ${mode === 'text' ? 'bg-white shadow' : 'opacity-50'}`}>✍️ Texte</button>
          <button onClick={() => setMode('media')} className={`flex-1 py-2 rounded-lg font-bold ${mode === 'media' ? 'bg-white shadow' : 'opacity-50'}`}>📸 Photo</button>
          <button onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold ${mode === 'audio' ? 'bg-white shadow' : 'opacity-50'}`}>🎙️ Audio</button>
        </div>

        <div>
          <label className="text-xs font-mono font-bold opacity-50 uppercase">Titre</label>
          <input type="text" className="w-full border-2 rounded-xl p-3 outline-none" value={title} onChange={e=>setTitle(e.target.value)} />
        </div>

        {isPactMode && (
          <div className="bg-[#FDF8F0] p-4 rounded-xl border">
            <label className="text-xs font-mono font-bold block mb-2">📁 Médias (Multi-fichiers)</label>
            <input type="file" multiple className="w-full text-sm" onChange={e => setPactFiles(Array.from(e.target.files || []))} />
          </div>
        )}

        {mode === 'text' && <textarea className="w-full border-2 rounded-xl p-4 outline-none min-h-[100px]" value={textContent} onChange={e=>setTextContent(e.target.value)} />}
        {mode === 'file' && !isFlashMode && <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} />}
        {mode === 'media' && <input type="file" accept="image/*,video/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)} />}
        
        {mode === 'audio' && (
          <div>
            {!isRecording && !audioUrl && <button onClick={startRecording} className="w-full bg-red-500 text-white py-2 rounded-lg font-bold">🔴 Enregistrer</button>}
            {isRecording && <button onClick={stopRecording} className="w-full bg-black text-white py-2 rounded-lg font-bold animate-pulse">⏹ Arrêter</button>}
            {audioUrl && !isRecording && <audio controls src={audioUrl} className="w-full mt-2" />}
          </div>
        )}

        {!isFlashMode && !isPactMode && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex bg-white rounded-xl border p-1">
              <button onClick={() => setVisibility('public')} className={`flex-1 py-2 text-xs font-bold rounded ${visibility === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A]' : 'opacity-50'}`}>🌍 Public</button>
              <button onClick={() => setVisibility('friends')} className={`flex-1 py-2 text-xs font-bold rounded ${visibility === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E]' : 'opacity-50'}`}>👥 Amis</button>
              <button onClick={() => setVisibility('private')} className={`flex-1 py-2 text-xs font-bold rounded ${visibility === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E]' : 'opacity-50'}`}>🔒 Privé</button>
            </div>
            <input type="date" value={revealAt} onChange={e=>setRevealAt(e.target.value)} className="w-full border-2 p-2 rounded-lg bg-yellow-50 text-sm" placeholder="Capsule Temporelle" />
          </div>
        )}

        {isPactMode && (
          <input type="number" min="2" className="w-full border-2 p-2 rounded-lg text-center font-bold" value={requiredSignatures} onChange={e=>setRequiredSignatures(parseInt(e.target.value))} />
        )}

        <button onClick={handleSeal} className="w-full p-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#E76F51] to-[#F4A261] mt-4">SCELLER</button>
      </div>
    </div>
  );
}

export default function Seal() {
  return <Suspense fallback={<div className="p-10 text-center">Chargement...</div>}><SealContent /></Suspense>;
}
