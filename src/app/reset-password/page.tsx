'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('');

  async function handleReset() {
    if (!password) return setStatus('Mot de passe requis');
    const res = await fetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) });
    const data = await res.json();
    if (res.ok) {
      setStatus('✅ Mot de passe modifié !');
      setTimeout(() => router.push('/login'), 1500);
    } else setStatus('❌ ' + data.error);
  }

  return (
    <div className="max-w-md mx-auto bg-[#FFFCF7] p-8 rounded-3xl border border-[#EFE0CA] shadow-sm mt-10">
      <h1 className="text-3xl font-bold mb-6 font-serif">Nouveau mot de passe</h1>
      <div className="relative mb-4">
        <input type={show ? "text" : "password"} placeholder="Nouveau mot de passe" className="w-full border-2 border-[#EFE0CA] p-3 rounded-xl pr-10" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={() => setShow(!show)} className="absolute right-3 top-3">{show ? "🙈" : "👁️"}</button>
      </div>
      <button onClick={handleReset} className="w-full bg-[#2C1810] text-white p-3 rounded-xl font-bold">Valider</button>
      {status && <p className="mt-4 text-center font-bold">{status}</p>}
    </div>
  );
}

export default function ResetPassword() {
  return <Suspense fallback={<div>Chargement...</div>}><ResetForm /></Suspense>;
}
