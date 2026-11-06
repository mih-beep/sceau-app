'use client';
import { useState, useRef } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Seal() {
  const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Art');
  const [workType, setWorkType] = useState('fichier'); // NOUVEAU
  const [isHosted, setIsHosted] = useState(true);
  const [visibility, setVisibility] = useState('public');
  const [status, setStatus] = useState('');

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
    if (!title) return setStatus("Le titre est requis");
    if (mode === 'file' && !file) return setStatus("Choisis un fichier");
    if (mode === 'text' && !textContent) return setStatus("Écris quelque chose");
    if (mode === 'media' && !file) return setStatus("Prends une photo ou vidéo");
    if (mode === 'audio' && !file) return setStatus("Enregistre un audio");

    setStatus("Calcul de l'empreinte...");
    try {
      let fileToSeal = file;
      if (mode === 'text') {
        const blob = new Blob([textContent], { type: 'text/plain' });
        fileToSeal = new File([blob], `${title.replace(/\s+/g, '-').toLowerCase()}.txt`, { type: 'text/plain' });
      }
      if (!fileToSeal) return;

      const buffer = await fileToSeal.arrayBuffer();
      const hash = sha256(new Uint8Array(buffer));
      let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
      const hashB64 = btoa(hashStr);
      
      const pubkey = localStorage.getItem('sceau_pubkey');
      if (!pubkey) return setStatus("Créez un compte d'abord !");

      setStatus("Ancrage dans le registre...");

      const formData = new FormData();
      formData.append('hash', hashB64);
      formData.append('title', title);
      formData.append('description', desc);
      formData.append('category', cat);
      formData.append('workType', workType); // NOUVEAU
      formData.append('isHosted', isHosted.toString());
      formData.append('visibility', visibility);
      formData.append('pubkey', pubkey);
      formData.append('file', fileToSeal);

      const res = await fetch('/api/seal', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (res.ok) {
        setStatus("✅ Scellé avec succès !");
        setTitle(''); setDesc(''); setFile(null); setTextContent(''); setAudioUrl(null);
      } else {
        setStatus("❌ Erreur : " + data.error);
      }
    } catch (e) { setStatus("❌ Erreur système"); }
  }

  return (
    <div className="p-6 font-serif">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2" style={{color: 'var(--text-main)'}}>L'Atelier.</h1>
        <p className="italic text-[var(--text-muted)]">Créez et scellez en un clic.</p>
      </div>

      <div className="space-y-4 max-w-md mx-auto bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
        <div className="flex bg-[var(--bg-main)] p-1 rounded-xl mb-4 text-xs font-mono">
          <button onClick={() => setMode('file')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'file' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>📁 Fichier</button>
          <button onClick={() => setMode('text')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'text' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>✍️ Texte</button>
          <button onClick={() => setMode('media')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'media' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>📸 Direct</button>
          <button onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'audio' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{color: 'var(--text-main)'}}>🎙️ Audio</button>
        </div>

        <div>
          <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Titre de l'œuvre</label>
          <input type="text" className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" style={{color: 'var(--text-main)'}} value={title} onChange={e=>setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Type d'œuvre</label>
            <select className="w-full border-2 border-[var(--border-color)] rounded-xl p-3 outline-none bg-transparent" style={{color: 'var(--text-main)'}} value={workType} onChange={e=>setWorkType(e.target.value)}>
              <option value="fichier">Fichier simple</option>
              <option value="chapitre">Chapitre de livre</option>
              <option value="demo">Démo musicale</option>
              <option value="portfolio">Pièce de portfolio</option>
              <option value="memoire">Mémoire / Thèse</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Catégorie</label>
            <select className="w-full border-2 border-[var(--border-color)] rounded-xl p-3 outline-none bg-transparent" style={{color: 'var(--text-main)'}} value={cat} onChange={e=>setCat(e.target.value)}>
              <option>Art</option><option>Musique</option><option>Code</option><option>Écrit</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Description</label>
          <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">
              {mode === 'media' ? 'Capture' : mode === 'file' ? 'Fichier' : mode === 'audio' ? 'Enregistreur' : 'Texte'}
            </label>
            {mode === 'file' && <input type="file" className="w-full text-sm mt-2 opacity-80" onChange={e=>setFile(e.target.files?.[0]||null)} />}
            {mode === 'media' && <input type="file" accept="image/*,video/*" capture="environment" className="w-full text-sm mt-2 opacity-80" onChange={e=>setFile(e.target.files?.[0]||null)} />}
            {mode === 'audio' && (
              <div className="mt-2">
                {!isRecording && !audioUrl && <button onClick={startRecording} className="w-full bg-red-500 text-white py-2 rounded-lg font-bold text-xs">🔴 Enregistrer</button>}
                {isRecording && <button onClick={stopRecording} className="w-full bg-black text-white py-2 rounded-lg font-bold text-xs animate-pulse">⏹ Arrêter</button>}
                {audioUrl && !isRecording && <audio controls src={audioUrl} className="w-full h-10" />}
              </div>
            )}
            {mode === 'text' && <div className="text-xs text-[var(--text-muted)] mt-2">Zone texte ↓</div>}
          </div>
        </div>

        {mode === 'text' && (
          <div className="mt-2">
            <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-4 outline-none bg-transparent min-h-[100px] font-mono text-sm" style={{color: 'var(--text-main)'}} placeholder="Écrivez votre chef-d'œuvre ici..." value={textContent} onChange={e=>setTextContent(e.target.value)} />
          </div>
        )}

        <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-2 mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isHosted} onChange={e=>setIsHosted(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
            <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>Héberger le fichier</span>
          </label>
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Visibilité de l'œuvre</label>
            <div className="flex bg-white rounded-xl border border-[var(--border-color)] p-1">
              <button onClick={() => setVisibility('public')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${visibility === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A] shadow' : 'opacity-50'}`}>🌍 Public</button>
              <button onClick={() => setVisibility('friends')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${visibility === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E] shadow' : 'opacity-50'}`}>👥 Amis</button>
              <button onClick={() => setVisibility('private')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${visibility === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E] shadow' : 'opacity-50'}`}>🔒 Privé</button>
            </div>
          </div>
        </div>
        
        <button onClick={handleSeal} className="w-full bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white p-4 rounded-xl font-bold shadow-lg mt-4">SCELLER MON ŒUVRE</button>
        {status && <p className="text-center font-bold mt-4 text-[#E76F51]">{status}</p>}
      </div>
    </div>
  );
}
