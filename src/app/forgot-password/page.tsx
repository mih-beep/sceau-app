'use client';
import { useState } from 'react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  async function handleReset() {
    setLink(''); setError('');
    const res = await fetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    const data = await res.json();
    if (res.ok) setLink(data.link);
    else setError(data.error);
  }

  return (
    <div className="max-w-md mx-auto bg-[#FFFCF7] p-8 rounded-3xl border border-[#EFE0CA] shadow-sm mt-10">
      <h1 className="text-3xl font-bold mb-4 font-serif">Mot de passe oublié</h1>
      <p className="text-sm text-[#7A5A3A] mb-6">Entre ton email pour recevoir un lien de réinitialisation.</p>
      
      <input type="email" placeholder="Ton email" className="w-full border-2 border-[#EFE0CA] p-3 rounded-xl mb-4" value={email} onChange={e => setEmail(e.target.value)} />
      <button onClick={handleReset} className="w-full bg-[#E76F51] text-white p-3 rounded-xl font-bold mb-4">Envoyer le lien</button>
      
      {link && (
        <div className="bg-[#F5F9EE] border border-[#7A9B5A] p-4 rounded-xl text-sm break-all">
          <p className="font-bold text-[#5D7A3A] mb-2">✅ (Mode Test) Voici ton lien :</p>
          <a href={link} className="text-blue-600 underline">{link}</a>
        </div>
      )}
      {error && <p className="text-red-500 font-bold text-center">{error}</p>}
    </div>
  );
}
