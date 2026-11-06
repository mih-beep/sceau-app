'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import Link from 'next/link';

export default function Seal() {
  const [isFlashMode, setIsFlashMode] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isMystery, setIsMystery] = useState(false);
  const [unlockLikes, setUnlockLikes] = useState(10);
  const [visibility, setVisibility] = useState('public');
  const [status, setStatus] = useState('');
  const [sealedResult, setSealedResult] = useState<any>(null);

  async function handleSeal() {
    if (!title) return setStatus("Un titre ou une idée est requise");
    if (!isFlashMode && !file) return setStatus("Choisis un fichier à protéger");

    setStatus("Gravure en cours...");
    try {
      let hashB64 = "";
      
      // Calcul du hash
      if (isFlashMode && !file) {
        // Flash Textuel : on hash le texte
        const hash = sha256(new TextEncoder().encode(desc || title));
        let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
        hashB64 = btoa(hashStr);
      } else if (file) {
        const buffer = await file.arrayBuffer();
        const hash = sha256(new Uint8Array(buffer));
        let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
        hashB64 = btoa(hashStr);
      }

      const pubkey = localStorage.getItem('sceau_pubkey');
      if (!pubkey) return setStatus("Connecte-toi d'abord !");

      const formData = new FormData();
      formData.append('hash', hashB64);
      formData.append('title', title);
      formData.append('description', desc);
      formData.append('isFlash', isFlashMode.toString());
      formData.append('isMystery', isMystery.toString());
      formData.append('unlockLikes', unlockLikes.toString());
      formData.append('visibility', visibility);
      formData.append('pubkey', pubkey);
      
      // RÈGLE D'OR DU FLASH : On n'héberge JAMAIS le fichier
      if (!isFlashMode && file) {
        formData.append('isHosted', 'true');
        formData.append('file', file);
      } else {
        formData.append('isHosted', 'false');
      }

      const res = await fetch('/api/seal', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (res.ok) {
        setStatus("✅ Gravure réussie !");
        setSealedResult({ title, hash: hashB64, id: data.seal_id, date: new Date().toLocaleDateString('fr-FR'), isFlash: isFlashMode });
      } else {
        setStatus("❌ " + data.error);
      }
    } catch (e) { setStatus("❌ Erreur de gravure"); }
  }

  if (sealedResult) {
    return (
      <div className="p-6 font-serif text-center flex flex-col items-center">
        <div className="text-6xl mb-4">{sealedResult.isFlash ? '⚡' : '✅'}</div>
        <h1 className="text-3xl font-bold mb-2" style={{color: 'var(--text-main)'}}>
          {sealedResult.isFlash ? "Idée gravée à la vitesse de l'éclair." : "C'est dans le marbre."}
        </h1>
        <p className="text-sm text-[#7A5A3A] mb-8">
          {sealedResult.isFlash ? "Le fichier n'a jamais quitté ton appareil. Seul le hash est public." : "Ton œuvre est protégée."}
        </p>
        
        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-color)] w-full max-w-sm text-left shadow-lg">
          <h3 className="font-bold mb-2" style={{color: '#2C1810'}}>{sealedResult.title}</h3>
          <p className="text-[0.6rem] font-mono text-[#A89070] break-all bg-[var(--bg-main)] p-2 rounded border border-[var(--border-color)]">{sealedResult.hash}</p>
          <p className="text-xs text-right mt-2 text-[#7A5A3A]">Scellé le {sealedResult.date}</p>
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
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2" style={{color: 'var(--text-main)'}}>
          {isFlashMode ? "Flash." : "L'Atelier."}
        </h1>
        <p className="italic text-[var(--text-muted)]">
          {isFlashMode ? "Une idée ? Grave-la en 1 seconde." : "Créez et protégez votre œuvre."}
        </p>
      </div>

      {/* TOGGLE FLASH / NORMAL */}
      <div className="flex bg-[var(--bg-main)] p-1 rounded-xl mb-6">
        <button onClick={() => setIsFlashMode(false)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${!isFlashMode ? 'bg-[var(--bg-surface)] shadow text-[#E76F51]' : 'opacity-50'}`}>📁 Mode Normal</button>
        <button onClick={() => setIsFlashMode(true)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isFlashMode ? 'bg-[var(--text-main)] shadow text-white' : 'opacity-50'}`}>⚡ Mode Flash</button>
      </div>

      <div className="space-y-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
        
        {isFlashMode && (
          <div className="bg-[#FDF8F0] border-l-4 border-[#E76F51] p-3 mb-4 text-xs text-[#7A5A3A] italic">
            ⚡ <strong>Mode Flash :</strong> Ton fichier ou texte reste sur ton appareil. Seul le hash est gravé. Instantané, secret, infalsifiable.
          </div>
        )}

        <div>
          <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">{isFlashMode ? "Ton idée en 1 phrase" : "Titre de l'œuvre"}</label>
          <input type="text" className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" placeholder={isFlashMode ? "Ex: Je vais créer une app de preuve..." : "Titre..."} value={title} onChange={e=>setTitle(e.target.value)} autoFocus={isFlashMode} />
        </div>

        {isFlashMode ? (
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Détails (Secret)</label>
            <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" rows={3} placeholder="Développe ton idée ici. Personne ne la verra, elle sert juste à calculer le hash." value={desc} onChange={e=>setDesc(e.target.value)} />
            
            <div className="mt-4 border-2 border-dashed border-[var(--border-color)] p-4 rounded-xl text-center">
               <label className="text-xs font-bold text-[var(--text-main)] cursor-pointer">
                 <span className="text-2xl block mb-2">📸</span>
                 Prendre une photo/vidéo à la volée (Optionnel)
                 <input type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={e=>setFile(e.target.files?.[0]||null)} />
               </label>
               {file && <p className="text-xs text-green-600 mt-2 font-bold">Fichier prêt (reste local)</p>}
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Description</label>
              <textarea className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Fichier à héberger</label>
              <input type="file" className="w-full text-sm mt-2" onChange={e=>setFile(e.target.files?.[0]||null)} />
            </div>
            <div className="flex bg-white rounded-xl border border-[var(--border-color)] p-1">
              <button onClick={() => setVisibility('public')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${visibility === 'public' ? 'bg-[#F5F9EE] text-[#5D7A3A]' : 'opacity-50'}`}>🌍 Public</button>
              <button onClick={() => setVisibility('friends')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${visibility === 'friends' ? 'bg-[#F0F6FC] text-[#2D6A9E]' : 'opacity-50'}`}>👥 Amis</button>
              <button onClick={() => setVisibility('private')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${visibility === 'private' ? 'bg-[#FDF4F0] text-[#C44A2E]' : 'opacity-50'}`}>🔒 Privé</button>
            </div>
            <label className="flex items-center gap-3 mt-4 cursor-pointer">
              <input type="checkbox" checked={isMystery} onChange={e=>setIsMystery(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
              <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>🎭 En faire un Sceau Mystère</span>
            </label>
          </>
        )}

        <button onClick={handleSeal} className={`w-full p-4 rounded-xl font-bold shadow-lg mt-6 text-white ${isFlashMode ? 'bg-[#2C1810]' : 'bg-gradient-to-r from-[#E76F51] to-[#F4A261]'}`}>
          {isFlashMode ? 'GRAVER EN 1 CLIC' : 'SCELLER MON ŒUVRE'}
        </button>
        {status && <p className="text-center font-bold mt-2 text-[#E76F51]">{status}</p>}
      </div>
    </div>
  );
}
