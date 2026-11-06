'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Reset() {
  const router = useRouter();
  
  useEffect(() => {
    // On vide toute la mémoire du téléphone
    localStorage.clear();
    // On attend 2 secondes et on renvoie vers l'accueil
    setTimeout(() => router.push('/'), 2000);
  }, [router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center font-serif">
      <div className="text-5xl mb-4 animate-spin">⏳</div>
      <h1 className="text-2xl font-bold mb-2" style={{color: 'var(--text-main)'}}>Nettoyage en cours...</h1>
      <p className="text-[var(--text-muted)] italic">Fermeture de la session précédente. Redirection...</p>
    </div>
  );
}
