'use client';
import { useState, useRef } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import Link from 'next/link';

export default function Seal() {
  const [isFlashMode, setIsFlashMode] = useState(false);
  const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio'>('file');
  
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isHosted, setIsHosted] = useState(true); // Restauré
  const [isMystery, setIsMystery] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [unlockLikes, setUnlockLikes] = useState(10);
  
  const [status, setStatus] = useState('');
  const [sealedResult, setSealedResult] = useState<any>(null);

  // Audio
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
    if (!isFlashMode && mode === 'file' && !file) return setStatus("Choisis un fichier");
    if (!isFlashMode && mode === 'text' && !textContent) return setStatus("Écris quelque chose");
    if (!isFlashMode && mode === 'media' && !file) return setStatus("Prends une photo ou vidéo");
    if (!isFlashMode && mode === 'audio' && !file) return setStatus("Enregistre un audio");

    setStatus("Calcul de l'empreinte...");
    try {
      let fileToSeal = file;
      
      if (isFlashMode && !file) {
        const hash = sha256(new TextEncoder().encode(desc || title));
        let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
        return sendToServer(btoa(hashStr), null);
      }

      if (mode === 'text') {
        const blob = new Blob([textContent], { type: 'text/plain' });
        fileToSeal = new File([blob], `${title.replace(/\s+/g, '-').toLowerCase()}.txt`, { type: 'text/plain' });
      }
      if (!fileToSeal) return;

      const buffer = await fileToSeal.arrayBuffer();
      const hash = sha256(new Uint8Array(buffer));
      let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
      
      sendToServer(btoa(hashStr), fileToSeal);
    } catch (e) { setStatus("❌ Erreur de gravure"); }
  }

  async function sendToServer(hashB64: string, fileToUpload: File | null) {
    const pubkey = localStorage.getItem('sceau_pubkey');
    if (!pubkey) return setStatus("Connecte-toi d'abord !");

    setStatus("Ancrage dans la blockchain Bitcoin... (Patientez)");

    const formData = new FormData();
    formData.append('hash', hashB64);
    formData.append('title', title);
    formData.append('description', mode === 'text' ? textContent : desc);
    formData.append('isFlash', isFlashMode.toString());
    formData.append('isMystery', isMystery.toString());
    formData.append('isEphemeral', isEphemeral.toString());
    formData.append('unlockLikes', unlockLikes.toString());
    formData.append('pubkey', pubkey);
    
    if (isHosted && fileToUpload && !isFlashMode) {
      formData.append('isHosted', 'true');
      formData.append('file', fileToUpload);
    } else {
      formData.append('isHosted', 'false');
    }

    const res = await fetch('/api/seal', { method: 'POST', body: formData });
    const data = await res.json();
    
    if (res.ok) {
      setStatus("✅ Scellé avec succès !");
      setSealedResult({ 
        title, hash: hashB64, id: data.seal_id, date: new Date().toLocaleDateString('fr-FR'), 
        isFlash: isFlashMode, otsSecured: data.ots_secured
      });
    } else {
      setStatus("❌ " + data.error);
    }
  }

  if (sealedResult) {
    return (
      <div className="p-6 font-serif text-center flex flex-col items-center">
        <div className="text-6xl mb-4">{sealedResult.isFlash ? '⚡' : '✅'}</div>
        <h1 className="text-3xl font-bold mb-2" style={{color: 'var(--text-main)'}}>
          {sealedResult.isFlash ? "Idée gravée." : "C'est dans le marbre."}
        </h1>
        
        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-color)] w-full max-w-sm text-left shadow-lg mt-6">
          <h3 className="font-bold mb-2" style={{color: '#2C1810'}}>{sealedResult.title}</h3>
          <p className="text-[0.6rem] font-mono text-[#A89070] break-all bg-[var(--bg-main)] p-2 rounded border border-[var(--border-color)]">{sealedResult.hash}</p>
          
          {sealedResult.otsSecured ? (
            <div className="mt-3 bg-[#F5F9EE] border border-[#A8C77E] p-2 rounded-lg flex items-center gap-2">
              <span className="text-xl">⛓️</span>
              <div>
                <p className="text-[0.65rem] font-bold text-[#5D7A3A]">Preuve Bitcoin (OpenTimestamps)</p>
                <p className="text-[0.55rem] text-[#7A9B5A]">Ancré avec succès</p>
              </div>
            </div>
          ) : (
            <div className="mt-3 bg-[#FCEAD6] border border-[#F4D0A8] p-2 rounded-lg flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <div>
                <p className="text-[0.65rem] font-bold text-[#C44A2E]">Preuve serveur</p>
                <p className="text-[0.55rem] text-[#C44A2E]">L'ancrage Bitcoin a échoué (réseau)</p>
              </div>
            </div>
          )}
          <p className="text-xs text-right mt-3 text-[#7A5A3A]">Scellé le {sealedResult.date}</p>
        </div>
        
        <div className="flex gap-2 mt-8 w-full max-w-sm">
          <button onClick={() => window.location.reload()} className="flex-1 bg-[#2C1810] text-white p-3 rounded-xl font-bold text-sm">Nouveau</button>
          <Link href="/feed" className="flex-1 border-2 border-[#EFE0CA] text-[#2C1810] p-3 rounded-xl font-bold text-sm text-center">Voir le Feed</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 font-serif max-w-md mx-auto">
      
      <div className="flex justify-center mb-6">
        <div className="flex bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-color)]">
          <Link href="/seal" className="px-6 py-2 rounded-lg font-bold text-sm bg-[var(--bg-surface)] shadow text-[#E76F51]">✍️ Sceller</Link>
          <Link href="/verify" className="px-6 py-2 rounded-lg font-bold text-sm opacity-50 hover:opacity-100 transition">🔍 Vérifier</Link>
        </div>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2" style={{color: 'var(--text-main)'}}>
          {isFlashMode ? "Flash." : "L'Atelier."}
        </h1>
      </div>

      <div className="flex bg-[var(--bg-main)] p-1 rounded-xl mb-6">
        <button onClick={() => setIsFlashMode(false)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${!isFlashMode ? 'bg-[var(--bg-surface)] shadow text-[#E76F51]' : 'opacity-50'}`}>📁 Normal</button>
        <button onClick={() => setIsFlashMode(true)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isFlashMode ? 'bg-[var(--text-main)] shadow text-white' : 'opacity-50'}`}>⚡ Flash</button>
      </div>

      <div className="space-y-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
        
        {!isFlashMode && (
          <div className="flex bg-[var(--bg-main)] p-1 rounded-xl mb-4 text-xs font-mono">
            <button onClick={() => setMode('file')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'file' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>📁 Fichier</button>
            <button onClick={() => setMode('text')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'text' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>✍️ Texte</button>
            <button onClick={() => setMode('media')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'media' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>📸 Direct</button>
            <button onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'audio' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>🎙️ Audio</button>
          </div>
        )}

        <div>
          <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">{isFlashMode ? "Ton idée en 1 phrase" : "Titre de l'œuvre"}</label>
          <input type="text" className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" placeholder={isFlashMode ? "Ex: Je vais créer une app..." : "Titre..."} value={title} onChange={e=>setTitle(e.target.value)} autoFocus={isFlashMode} />
        </div>

        {!isFlashMode && mode !== 'text' && (
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Description</label>
            <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} />
          </div>
        )}

        {!isFlashMode && mode === 'file' && (
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Fichier</label>
            <input type="file" className="w-full text-sm mt-2" onChange={e=>setFile(e.target.files?.[0]||null)} />
          </div>
        )}

        {!isFlashMode && mode === 'media' && (
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Capture Photo/Vidéo</label>
            <input type="file" accept="image/*,video/*" capture="environment" className="w-full text-sm mt-2" onChange={e=>setFile(e.target.files?.[0]||null)} />
          </div>
        )}

        {!isFlashMode && mode === 'audio' && (
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Enregistreur Audio</label>
            <div className="mt-2">
              {!isRecording && !audioUrl && <button onClick={startRecording} className="w-full bg-red-500 text-white py-2 rounded-lg font-bold text-xs">🔴 Enregistrer</button>}
              {isRecording && <button onClick={stopRecording} className="w-full bg-black text-white py-2 rounded-lg font-bold text-xs animate-pulse">⏹ Arrêter</button>}
              {audioUrl && !isRecording && <audio controls src={audioUrl} className="w-full h-10" />}
            </div>
          </div>
        )}

        {!isFlashMode && mode === 'text' && (
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Contenu du texte</label>
            <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-4 outline-none bg-transparent min-h-[100px] font-mono text-sm" placeholder="Écrivez votre chef-d'œuvre ici..." value={textContent} onChange={e=>setTextContent(e.target.value)} />
          </div>
        )}

        {!isFlashMode && (
          <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 mt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isHosted} onChange={e=>setIsHosted(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>☁️ Héberger le fichier (Cloud SCEAU)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isMystery} onChange={e=>setIsMystery(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>🎭 Sceau Mystère</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isEphemeral} onChange={e=>setIsEphemeral(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>⏳ Éphémère (24h)</span>
            </label>
          </div>
        )}

        <button onClick={handleSeal} className={`w-full p-4 rounded-xl font-bold shadow-lg mt-6 text-white ${isFlashMode ? 'bg-[#2C1810]' : 'bg-gradient-to-r from-[#E76F51] to-[#F4A261]'}`}>
          {isFlashMode ? 'GRAVER EN 1 CLIC' : 'SCELLER MON ŒUVRE'}
        </button>
        {status && <p className="text-center font-bold mt-2 text-[#E76F51]">{status}</p>}
      </div>
    </div>
  );
}
