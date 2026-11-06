'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center font-serif">
      <div className="text-6xl mb-6">🔍</div>
      <h1 className="text-4xl font-bold mb-4" style={{color: 'var(--text-main)'}}>Œuvre introuvable.</h1>
      <p className="text-[var(--text-muted)] italic mb-8 max-w-sm mx-auto">
        Cette page n'existe pas, ou l'œuvre a été déplacée dans le coffre privé de son créateur.
      </p>
      <Link href="/feed" className="bg-[#E76F51] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-[#F4A261] transition">
        Retour au réseau
      </Link>
    </div>
  );
}
