'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  async function handleLogin() {
    if (!email || !password) return setStatus("Email et mot de passe requis");
    setStatus("Connexion...");
    
    const res = await fetch('/api/auth/login', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ email, password }) 
    });
    
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('sceau_pubkey', data.pubkey);
      localStorage.setItem('sceau_handle', data.handle);
      setStatus("✅ Connecté !");
      setTimeout(() => router.push('/feed'), 1000);
    } else {
      setStatus("❌ " + data.error);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-[#FFFCF7] p-8 rounded-3xl border border-[#EFE0CA] shadow-sm mt-10">
      <h1 className="text-3xl font-bold mb-6 font-serif">Se connecter</h1>
      
      <label className="block text-xs font-bold text-[#A89070] uppercase mb-1 font-mono">Email</label>
      <input type="email" className="w-full border-2 border-[#EFE0CA] p-3 rounded-xl mb-4" value={email} onChange={(e) => setEmail(e.target.value)} />
      
      <label className="block text-xs font-bold text-[#A89070] uppercase mb-1 font-mono">Mot de passe</label>
      <input type="password" className="w-full border-2 border-[#EFE0CA] p-3 rounded-xl mb-6" value={password} onChange={(e) => setPassword(e.target.value)} />
      
      <button onClick={handleLogin} className="w-full bg-[#2C1810] text-white p-4 rounded-xl font-bold">Connexion</button>
      {status && <p className="mt-4 text-center font-bold text-[#C44A2E]">{status}</p>}
      
      <p className="text-center mt-4 text-sm text-[#A89070]">Pas de compte ? <a href="/signup" className="underline font-bold">Créer un compte</a></p>
    </div>
  );
}
