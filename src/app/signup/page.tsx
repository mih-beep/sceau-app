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
      if (res.ok) setStatus("Compte créé ! Va sur /seal"); else setStatus("Erreur");
    } catch (e) { setStatus("Erreur réseau"); }
  }
  return (<main className="p-10 max-w-md mx-auto"><h1 className="text-2xl font-bold mb-4">Créer un compte</h1><input type="text" placeholder="Pseudo" className="border p-2 w-full mb-4 text-black" value={handle} onChange={(e) => setHandle(e.target.value)} /><button onClick={handleSignup} className="bg-blue-600 text-white p-2 rounded w-full">Créer</button><p className="mt-4 font-bold text-center text-black">{status}</p></main>);
}