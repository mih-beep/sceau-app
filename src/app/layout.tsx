'use client';
import './globals.css'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    setHandle(localStorage.getItem('sceau_handle'));
  }, [pathname]); // Se déclenche à chaque changement de page

  return (
    <html lang="fr">
      <body className="bg-[#F5E9D8] min-h-screen pb-24">
        <nav className="bg-[#FFFCF7] border-b border-[#EFE0CA] px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <Link href="/feed" className="text-2xl font-bold text-[#2C1810] tracking-tight font-serif">SCEAU<span className="text-[#E76F51]">.</span></Link>
          {!handle ? (
            <Link href="/signup" className="text-sm font-bold bg-[#E76F51] text-white px-4 py-2 rounded-lg">Créer un compte</Link>
          ) : (
            <Link href="/profil" className="text-sm font-bold text-[#2C1810]">@{handle}</Link>
          )}
        </nav>
        <main className="max-w-2xl mx-auto">{children}</main>
        <div className="fixed bottom-0 left-0 right-0 bg-[#FFFCF7] border-t border-[#EFE0CA] flex justify-around py-3 z-50">
          <Link href="/feed" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">🌐</span><span className="text-[0.6rem] font-bold font-mono">Réseau</span></Link>
          <Link href="/seal" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">✍️</span><span className="text-[0.6rem] font-bold font-mono">Sceller</span></Link>
          <Link href="/verify" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">🔍</span><span className="text-[0.6rem] font-bold font-mono">Vérifier</span></Link>
          <Link href="/messages" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">💬</span><span className="text-[0.6rem] font-bold font-mono">Messages</span></Link>
          <Link href="/profil" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">👤</span><span className="text-[0.6rem] font-bold font-mono">Profil</span></Link>
        </div>
      </body>
    </html>
  )
}
