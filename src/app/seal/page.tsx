'use client';
import { useState, useRef, Suspense } from 'react';
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
  const [isHosted, setIsHosted] = useState(true);
  const [isMystery, setIsMystery] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [unlockLikes, setUnlockLikes] = useState(10);
  const [requiredSignatures, setRequiredSignatures] = useState(2);

  const [status, setStatus] = useState('');
  const [sealedResult, setSealedResult] = useState<any>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
      mediaRecorder.start();
      setIsRecording(true);
    } catch { setStatus("❌ Impossible d'accéder au micro."); }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  }

  async function handleSeal() {
    setStatus('');

    if (!title.trim()) return setStatus("❌ Un titre est requis");
    if (isPactMode && pactFiles.length === 0) return setStatus("❌ Ajoute au moins un fichier au pacte");
    if (!isPactMode && mode === 'text' && !textContent.trim()) return setStatus("❌ Écris ton texte");
    if (!isPactMode && mode === 'file' && !file) return setStatus("❌ Choisis un fichier à sceller");
    if (!isPactMode && mode === 'media' && !file) return setStatus("❌ Prends une photo ou une vidéo");
    if (!isPactMode && mode === 'audio' && !file) return setStatus("❌ Enregistre un audio");

    setStatus(isPactMode ? "Préparation du pacte..." : "Calcul de l'empreinte...");
    try {
      let hashContent: Uint8Array;

      if (isPactMode) {
        const metaString = `${title}-${desc}-${pactFiles.map(f => f.name).join(',')}`;
        hashContent = sha256(new TextEncoder().encode(metaString));
      } else if (mode === 'text') {
        hashContent = sha256(new TextEncoder().encode(textContent));
      } else {
        if (!file) return setStatus("❌ Fichier manquant");
        hashContent = sha256(new Uint8Array(await file.arrayBuffer()));
      }

      let hashStr = '';
      for (let i = 0; i < hashContent.length; i++) hashStr += String.fromCharCode(hashContent[i]);
      await sendToServer(btoa(hashStr));
    } catch (e: any) {
      console.error(e);
      setStatus("❌ Erreur de gravure : " + (e?.message || 'inconnue'));
    }
  }

  async function sendToServer(hashB64: string) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return setStatus("❌ Connecte-toi d'abord !");

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
      pactFiles.forEach(f => formData.append('files', f));
    } else {
      formData.append('isFlash', isFlashMode.toString());
      formData.append('visibility', visibility);
      formData.append('isMystery', isMystery.toString());
      formData.append('isEphemeral', isEphemeral.toString());
      formData.append('unlockLikes', unlockLikes.toString());
      formData.append('isHosted', isHosted.toString());
      if (challengeIdParam) formData.append('challenge_id', challengeIdParam);
      if (mode !== 'text' && file) formData.append('file', file);
    }

    setStatus(isPactMode ? "Envoi du pacte..." : "Ancrage dans la blockchain (max 8s)…");

    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        return setStatus("❌ " + (data?.error || `Erreur serveur (${res.status})`));
      }

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
        setSealedResult({ title, hash: hashB64, date: new Date().toLocaleDateString('fr-FR'), isFlash: isFlashMode, ots: !!data.ots_secured });
      }
    } catch (e: any) {
      console.error(e);
      setStatus("❌ Erreur réseau : " + (e?.message || 'impossible de contacter le serveur'));
    }
  }

  if (sealedResult) {
    return (
      <div className="p-6 font-sans text-center flex flex-col items-center max-w-md mx-auto">
        <div className="text-6xl mb-4">{sealedResult.isFlash ? '⚡' : '✅'}</div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>C'est gravé.</h1>
        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-color)] w-full text-left shadow-lg mt-6">
          <h3 className="font-bold mb-2" style={{ color: 'var(--text-main)' }}>{sealedResult.title}</h3>
          <p className="text-[0.6rem] font-mono break-all text-[var(--text-muted)] bg-[var(--bg-main)] p-2 rounded border border-[var(--border-color)]">{sealedResult.hash}</p>
          <p className="text-xs text-right mt-3 text-[var(--text-muted)]">Scellé le {sealedResult.date}</p>
          {sealedResult.ots && <p className="text-xs mt-2 text-[#5D7A3A] font-bold">✅ Preuve horodatée</p>}
        </div>
        <button onClick={() => window.location.reload()} className="mt-8 bg-[#2C1810] text-white p-3 rounded-xl font-bold w-full">Sceller une autre œuvre</button>
        <Link href="/feed" className="mt-3 border-2 border-[var(--border-color)] text-[var(--text-main)] p-3 rounded-xl font-bold w-full text-center">Voir le Feed</Link>
      </div>
    );
  }

  return (
    <div className="p-6 font-sans max-w-md mx-auto">

      {/* === ONGLETS SCeller / Vérifier === */}
      {!isPactMode && (
        <div className="flex justify-center mb-6">
          <div className="flex bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-color)]">
            <Link href="/seal" className="px-6 py-2 rounded-lg font-bold text-sm bg-[var(--bg-surface)] shadow text-[#E76F51]">✍️ Sceller</Link>
            <Link href="/verify" className="px-6 py-2 rounded-lg font-bold text-sm opacity-50 hover:opacity-100 transition" style={{ color: 'var(--text-main)' }}>🔍 Vérifier</Link>
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
          {isPactMode ? "Nouveau Pacte." : (isFlashMode ? "Flash." : "L'Atelier.")}
        </h1>
      </div>

      {/* === Toggle Normal / Flash === */}
      {!isPactMode && (
        <div className="flex bg-[var(--bg-main)] p-1 rounded-xl mb-4 border border-[var(--border-color)]">
          <button type="button" onClick={() => { setIsFlashMode(false); setMode('file'); setIsHosted(true); setVisibility('public'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${!isFlashMode ? 'bg-[var(--bg-surface)] shadow text-[#E76F51]' : 'opacity-50'}`}>📁 Normal</button>
          <button type="button" onClick={() => { setIsFlashMode(true); setIsHosted(false); setVisibility('private'); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isFlashMode ? 'bg-[#2C1810] text-white shadow' : 'opacity-50'}`}>⚡ Flash</button>
        </div>
      )}

      <div className="space-y-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">

        {/* === Sélecteur de mode === */}
        {!isPactMode && (
          <div className="flex bg-[var(--bg-main)] p-1 rounded-xl text-xs font-mono">
            <button type="button" onClick={() => setMode('file')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'file' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>📁 Fichier</button>
            <button type="button" onClick={() => setMode('text')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'text' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>✍️ Texte</button>
            <button type="button" onClick={() => setMode('media')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'media' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>📸 Photo</button>
            <button type="button" onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'audio' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>🎙️ Audio</button>
          </div>
        )}

        {/* === Titre === */}
        <div>
          <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Titre</label>
          <input
            type="text"
            className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent mt-1"
            style={{ color: 'var(--text-main)' }}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={isPactMode ? "Nom du pacte" : (isFlashMode ? "Ton idée en un mot" : "Titre de l'œuvre")}
          />
        </div>

        {/* === Pacte : fichiers === */}
        {isPactMode && (
          <div className="bg-[#FDF8F0] p-4 rounded-xl border border-[#EFE0CA]">
            <label className="text-xs font-mono font-bold block mb-2" style={{ color: 'var(--text-main)' }}>📁 Médias (multi-fichiers)</label>
            <input type="file" multiple className="w-full text-sm" onChange={e => setPactFiles(Array.from(e.target.files || []))} />
            {pactFiles.length > 0 && <p className="text-xs mt-1 text-[var(--text-muted)]">{pactFiles.length} fichier(s) sélectionné(s)</p>}
          </div>
        )}

        {/* === Description (sauf text) === */}
        {!isPactMode && mode !== 'text' && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Description</label>
            <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent mt-1" rows={2} value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
        )}

        {/* === Texte === */}
        {mode === 'text' && !isPactMode && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Texte à sceller</label>
            <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-4 outline-none bg-transparent min-h-[100px] font-mono text-sm mt-1" value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Écris ton texte ici..." />
          </div>
        )}

        {/* === Fichier === */}
        {!isPactMode && mode === 'file' && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Fichier</label>
            <input type="file" className="w-full text-sm mt-1" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs mt-1 text-[var(--text-muted)]">📎 {file.name} ({(file.size / 1024).toFixed(0)} Ko)</p>}
          </div>
        )}

        {/* === Photo / vidéo === */}
        {!isPactMode && mode === 'media' && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Photo / Vidéo</label>
            <input type="file" accept="image/*,video/*" capture="environment" className="w-full text-sm mt-1" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs mt-1 text-[var(--text-muted)]">📎 {file.name}</p>}
          </div>
        )}

        {/* === Audio === */}
        {!isPactMode && mode === 'audio' && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Audio</label>
            <div className="mt-1">
              {!isRecording && !audioUrl && <button type="button" onClick={startRecording} className="w-full bg-red-500 text-white py-2 rounded-lg font-bold text-xs">🔴 Enregistrer</button>}
              {isRecording && <button type="button" onClick={stopRecording} className="w-full bg-[#2C1810] text-white py-2 rounded-lg font-bold text-xs animate-pulse">⏹ Arrêter</button>}
              {audioUrl && !isRecording && <audio controls src={audioUrl} className="w-full mt-2 h-10" />}
            </div>
          </div>
        )}

        {/* === Options (non-flash, non-pacte) === */}
        {!isFlashMode && !isPactMode && (
          <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 mt-4">
            <div>
              <label className="text-[0.65rem] font-mono font-bold uppercase block mb-2" style={{ color: 'var(--text-muted)' }}>Visibilité</label>
              <div className="flex bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] p-1">
                <button type="button" onClick={() => setVisibility('public')} className={`flex-1 py-2 text-xs font-bold rounded transition ${visibility === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A]' : 'opacity-50'}`}>🌍 Public</button>
                <button type="button" onClick={() => setVisibility('friends')} className={`flex-1 py-2 text-xs font-bold rounded transition ${visibility === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E]' : 'opacity-50'}`}>👥 Amis</button>
                <button type="button" onClick={() => setVisibility('private')} className={`flex-1 py-2 text-xs font-bold rounded transition ${visibility === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E]' : 'opacity-50'}`}>🔒 Privé</button>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isHosted} onChange={e => setIsHosted(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>☁️ Héberger le fichier</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isMystery} onChange={e => setIsMystery(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>🎭 Sceau Mystère</span>
            </label>

            {isMystery && (
              <div className="pl-7">
                <label className="text-[0.6rem] font-mono text-[var(--text-muted)] block">Likes requis pour révéler</label>
                <input type="number" min="1" value={unlockLikes} onChange={e => setUnlockLikes(parseInt(e.target.value) || 1)} className="w-full border border-[var(--border-color)] p-2 rounded text-sm bg-[var(--bg-surface)] mt-1" style={{ color: 'var(--text-main)' }} />
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isEphemeral} onChange={e => setIsEphemeral(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>⏳ Éphémère (24h)</span>
            </label>
          </div>
        )}

        {/* === Pacte : signatures === */}
        {isPactMode && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Signatures requises</label>
            <input type="number" min="2" value={requiredSignatures} onChange={e => setRequiredSignatures(parseInt(e.target.value) || 2)} className="w-full border-2 border-[var(--border-color)] p-2 rounded-lg text-center font-bold text-lg bg-transparent mt-1" style={{ color: 'var(--text-main)' }} />
          </div>
        )}

        {/* === Bouton SCELLER === */}
        <button
          type="button"
          onClick={handleSeal}
          className={`w-full p-4 rounded-xl font-bold text-white shadow-lg mt-2 ${isPactMode ? 'bg-[#4A90C2]' : (isFlashMode ? 'bg-[#2C1810]' : 'bg-gradient-to-r from-[#E76F51] to-[#F4A261]')}`}
        >
          {isPactMode ? 'CRÉER LE PACTE' : (isFlashMode ? 'GRAVER EN 1 CLIC' : 'SCELLER MON ŒUVRE')}
        </button>

        {/* === ✅ Affichage du statut — CE QUI MANQUAIT === */}
        {status && (
          <p className={`text-center font-bold text-sm p-3 rounded-lg border ${status.includes('✅') ? 'bg-[#F5F9EE] text-[#5D7A3A] border-[#A8C77E]' : status.includes('❌') ? 'bg-[#FDF4F0] text-[#C44A2E] border-[#FCE0D6]' : 'bg-[#F0F6FC] text-[#2D6A9E] border-[#C9D8E8]'}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Seal() {
  return <Suspense fallback={<div className="p-10 text-center font-mono">Chargement...</div>}><SealContent /></Suspense>;
}
