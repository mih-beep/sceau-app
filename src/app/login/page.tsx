'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('');

  async function handleLogin() {
    if (!email || !password) return setStatus("Email et mot de passe requis");
    setStatus("Connexion...");
    
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('sceau_pubkey', data.pubkey);
      localStorage.setItem('sceau_handle', data.handle);
      setStatus("✅ Connecté !");
      setTimeout(() => router.push('/feed'), 500);
    } else {
      setStatus("❌ " + data.error);
    }
  }

  // La fonction magique pour "Entrée"
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div className="max-w-md mx-auto bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm mt-10">
      <h1 className="text-3xl font-bold mb-6 font-serif" style={{color: 'var(--text-main)'}}>Se connecter</h1>
      
      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 font-mono">Email</label>
      <input type="email" onKeyDown={handleKeyPress} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl mb-4 bg-transparent" style={{color: 'var(--text-main)'}} value={email} onChange={(e) => setEmail(e.target.value)} />
      
      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 font-mono">Mot de passe</label>
      <div className="relative mb-2">
        <input type={showPassword ? "text" : "password"} onKeyDown={handleKeyPress} className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl pr-10 bg-transparent" style={{color: 'var(--text-main)'}} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 opacity-50">{showPassword ? "🙈" : "👁️"}</button>
      </div>
      
      <div className="text-right mb-6">
        <Link href="/forgot-password" className="text-sm text-[#E76F51] hover:underline font-bold">Mot de passe oublié ?</Link>
      </div>
      
      <button onClick={handleLogin} className="w-full bg-[var(--text-main)] text-[var(--bg-surface)] p-4 rounded-xl font-bold">Connexion</button>
      {status && <p className="mt-4 text-center font-bold text-[#E76F51]">{status}</p>}
      
      <p className="text-center mt-4 text-sm text-[var(--text-muted)]">Pas de compte ? <Link href="/signup" className="underline font-bold">Créer un compte</Link></p>
    </div>
  );
}
