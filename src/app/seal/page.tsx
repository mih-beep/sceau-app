'use client';
import { useState, useRef } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import { toPng } from 'html-to-image';

export default function Seal() {
  const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Art');
  const [workType, setWorkType] = useState('fichier');
  const [visibility, setVisibility] = useState('public');
  const [isHosted, setIsHosted] = useState(true);
  const [status, setStatus] = useState('');
  
  // Nouvelles options fun
  const [isMystery, setIsMystery] = useState(false);
  const [unlockLikes, setUnlockLikes] = useState(10);
  const [isFlash, setIsFlash] = useState(false);
  const [sealedResult, setSealedResult] = useState<any>(null);

  const [isNewVersion, setIsNewVersion] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [versionNumber, setVersionNumber] = useState(2);

  const cardRef = useRef<HTMLDivElement>(null);

  async function handleSeal() {
    if (!title && !isFlash) return setStatus("Le titre est requis");
    if (mode === 'file' && !file) return setStatus("Choisis un fichier");

    setStatus("Calcul...");
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

      setStatus("Ancrage...");
      const formData = new FormData();
      formData.append('hash', hashB64);
      formData.append('title', title || "Idée Flash");
      formData.append('description', desc);
      formData.append('category', cat);
      formData.append('workType', workType);
      formData.append('visibility', visibility);
      formData.append('isHosted', (isHosted && !isFlash).toString());
      formData.append('isMystery', isMystery.toString());
      formData.append('unlockLikes', unlockLikes.toString());
      formData.append('isFlash', isFlash.toString());
      formData.append('pubkey', pubkey);
      if (!isFlash) formData.append('file', fileToSeal);
      
      if (isNewVersion) {
        formData.append('project_id', projectId);
        formData.append('version_number', versionNumber.toString());
      }

      const res = await fetch('/api/seal', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (res.ok) {
        setStatus("✅ Scellé !");
        setSealedResult({ title, hash: hashB64, id: data.seal_id, date: new Date().toLocaleDateString('fr-FR') });
      } else {
        setStatus("❌ " + data.error);
      }
    } catch (e) { setStatus("❌ Erreur"); }
  }

  const downloadCard = async () => {
    if (cardRef.current) {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `SCEAU-${title}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  // Si on a scellé, on affiche la carte de preuve téléchargeable
  if (sealedResult) {
    return (
      <div className="p-6 font-serif text-center flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-6" style={{color: 'var(--text-main)'}}>C'est dans le marbre.</h1>
        <div ref={cardRef} className="bg-gradient-to-br from-[#FFFCF7] to-[#F5E9D8] p-8 rounded-3xl border border-[#E8D5B8] shadow-xl w-full max-w-sm text-left relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#E76F51] to-[#F4A261]"></div>
          <h2 className="text-3xl font-black mb-1" style={{color: '#2C1810'}}>SCEAU<span className="text-[#E76F51]">.</span></h2>
          <p className="text-xs font-mono font-bold text-[#A89070] mb-6">CERTIFICAT DE PREUVE</p>
          <h3 className="text-xl font-bold mb-4" style={{color: '#2C1810'}}>{sealedResult.title}</h3>
          <p className="text-[0.6rem] font-mono text-[#A89070] break-all bg-white p-2 rounded border border-[#EFE0CA] mb-4">{sealedResult.hash}</p>
          <p className="text-xs text-[#7A5A3A]">Scellé le {sealedResult.date}</p>
          <div className="mt-4 flex justify-between items-center">
             <span className="text-xs font-bold text-[#E76F51]">@{localStorage.getItem('sceau_handle')}</span>
             <span className="text-2xl">⚖️</span>
          </div>
        </div>
        <div className="flex gap-2 mt-8 w-full max-w-sm">
          <button onClick={downloadCard} className="flex-1 bg-[#2C1810] text-white p-3 rounded-xl font-bold text-sm">📸 Télécharger l'image</button>
          <button onClick={() => window.location.reload()} className="flex-1 border-2 border-[#EFE0CA] text-[#2C1810] p-3 rounded-xl font-bold text-sm">Nouveau</button>
        </div>
      </div>
    );
  }

  // Formulaire normal
  return (
    <div className="p-6 font-serif">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2" style={{color: 'var(--text-main)'}}>L'Atelier.</h1>
      </div>

      <div className="space-y-4 max-w-md mx-auto bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
        
        {/* Options Fun */}
        <div className="bg-[#FDF8F0] p-3 rounded-xl border border-[#EFE0CA] mb-2 space-y-2">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold" style={{color: 'var(--text-main)'}}>🎭 Sceau Mystère</span>
            <input type="checkbox" checked={isMystery} onChange={e=>setIsMystery(e.target.checked)} className="w-4 h-4 accent-[#E76F51]" />
          </label>
          {isMystery && (
             <input type="number" placeholder="Likes pour débloquer" className="w-full border border-[#EFE0CA] p-2 rounded text-xs" value={unlockLikes} onChange={e=>setUnlockLikes(parseInt(e.target.value))} />
          )}
          <label className="flex items-center justify-between cursor-pointer border-t border-[#EFE0CA] pt-2">
            <span className="text-sm font-bold text-[#C44A2E]">⚡ Sceau Flash (Secret total)</span>
            <input type="checkbox" checked={isFlash} onChange={e=>setIsFlash(e.target.checked)} className="w-4 h-4 accent-[#C44A2E]" />
          </label>
        </div>

        <div>
          <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Titre (ou Description pour Flash)</label>
          <input type="text" className="w-full border-2 border-[var(--border-color)] focus:border-[#E76F51] rounded-xl p-3 outline-none bg-transparent" value={title} onChange={e=>setTitle(e.target.value)} />
        </div>
        
        {!isFlash && (
          <div>
            <label className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Fichier</label>
            <input type="file" className="w-full text-sm mt-2" onChange={e=>setFile(e.target.files?.[0]||null)} />
          </div>
        )}

        <button onClick={handleSeal} className="w-full bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white p-4 rounded-xl font-bold shadow-lg mt-4">SCELLER</button>
        {status && <p className="text-center font-bold mt-2 text-[#E76F51]">{status}</p>}
      </div>
    </div>
  );
}
