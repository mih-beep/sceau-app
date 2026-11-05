'use client';
import { useState } from 'react';
import { ed25519 } from '@noble/curves/ed25519';

export default function Signup() {
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState('');

  async function handleSignup() {
    if (!handle) { setStatus("Pseudo requis"); return; }
    setStatus("Création...");
    try {
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const pubkey = ed25519.getPublicKey(secret);
      let pubkeyStr = ''; for (let i = 0; i < pubkey.length; i++) pubkeyStr += String.fromCharCode(pubkey[i]);
      let secretStr = ''; for (let i = 0; i < secret.length; i++) secretStr += String.fromCharCode(secret[i]);
      localStorage.setItem('sceau_secret', btoa(secretStr));
      localStorage.setItem('sceau_pubkey', btoa(pubkeyStr));

      const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle, pubkey: btoa(pubkeyStr) }) });
      if (res.ok) setStatus("✅ Compte créé ! Vous pouvez sceller.");
      else { const data = await res.json(); setStatus("Erreur : " + data.error); }
    } catch (e) { setStatus("Erreur réseau"); }
  }

  return (
    <div className="max-w-md mx-auto bg-[#FFFCF7] p-8 rounded-3xl border border-[#EFE0CA] shadow-sm mt-10">
      <h1 className="text-3xl font-bold mb-2">Créer un identifiant</h1>
      <p className="text-[#7A5A3A] mb-8 italic" style={{fontFamily: 'Cormorant Garamond'}}>Anonyme, gratuit, et unique.</p>
      <label className="block text-xs font-bold text-[#A89070] uppercase mb-1 mono">Pseudo</label>
      <input type="text" placeholder="Ex: marie" className="w-full border-2 border-[#EFE0CA] focus:border-[#E76F51] outline-none p-3 rounded-xl text-[#2C1810] bg-white transition mb-6" value={handle} onChange={(e) => setHandle(e.target.value)} />
      <button onClick={handleSignup} className="w-full bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white p-4 rounded-xl font-bold shadow-md hover:shadow-lg transition">
        Créer mon identité
      </button>
      {status && <p className="mt-4 font-bold text-center text-[#C44A2E]">{status}</p>}
    </div>
  );
}
