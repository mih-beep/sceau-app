'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ed25519 } from '@noble/curves/ed25519';
import Link from 'next/link';

export default function Signup() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('');

  async function handleSignup() {
    if (!handle || !email || !password) return setStatus("Tous les champs sont requis");
    setStatus("Création en cours...");
    
    try {
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const pubkey = ed25519.getPublicKey(secret);
      let pubkeyStr = ''; for (let i = 0; i < pubkey.length; i++) pubkeyStr += String.fromCharCode(pubkey[i]);
      let secretStr = ''; for (let i = 0; i < secret.length; i++) secretStr += String.fromCharCode(secret[i]);
      const pubkeyB64 = btoa(pubkeyStr);

      localStorage.setItem('sceau_secret', btoa(secretStr));

      const res = await fetch('/api/auth/signup', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ handle, email, password, pubkey: pubkeyB64 }) 
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('sceau_pubkey', pubkeyB64);
        localStorage.setItem('sceau_handle', handle);
        setStatus("✅ Compte créé !");
        setTimeout(() => router.push('/feed'), 500);
      } else {
        setStatus("❌ " + data.error);
      }
    } catch (e) { setStatus("❌ Erreur réseau"); }
  }

  // La fonction magique pour "Entrée"
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSignup(); };

  return (
    <div className="max-w-md mx-auto bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm mt-10">
      <h1 className="text-3xl font-bold mb-6 font-serif" style={{color: 'var(--text-main)'}}>Créer un compte</h1>
      
      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 font-mono">Pseudo</label>
      <input type="text" onKeyDown={handleKeyPress} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={handle} onChange={(e) => setHandle(e.target.value)} />
      
      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 font-mono">Email</label>
      <input type="email" onKeyDown={handleKeyPress} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={email} onChange={(e) => setEmail(e.target.value)} />
      
      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 font-mono">Mot de passe</label>
      <div className="relative mb-6">
        <input type={showPassword ? "text" : "password"} onKeyDown={handleKeyPress} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl pr-10 bg-transparent" style={{color: 'var(--text-main)'}} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 opacity-50">{showPassword ? "🙈" : "👁️"}</button>
      </div>
      
      <button onClick={handleSignup} className="w-full bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white p-4 rounded-xl font-bold">S'inscrire</button>
      {status && <p className="mt-4 text-center font-bold text-[#E76F51]">{status}</p>}
      
      <p className="text-center mt-4 text-sm text-[var(--text-muted)]">Déjà un compte ? <Link href="/login" className="underline font-bold">Se connecter</Link></p>
    </div>
  );
}
