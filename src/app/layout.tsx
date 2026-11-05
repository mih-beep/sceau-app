'use client';
import './globals.css'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [handle, setHandle] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setHandle(localStorage.getItem('sceau_handle'));
    const theme = localStorage.getItem('sceau_theme');
    if (theme === 'dark') { setIsDark(true); document.documentElement.classList.add('dark'); }
  }, [pathname]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('sceau_theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('sceau_theme', 'light'); }
  };

  return (
    <html lang="fr">
      <body className="min-h-screen pb-24">
        <nav className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <Link href="/feed" className="text-2xl font-bold tracking-tight font-serif" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51]">.</span></Link>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="text-xl cursor-pointer">{isDark ? '☀️' : '🌙'}</button>
            {!handle ? (
              <Link href="/signup" className="text-sm font-bold bg-[#E76F51] text-white px-4 py-2 rounded-lg">Créer un compte</Link>
            ) : (
              <Link href="/profil" className="text-sm font-bold" style={{color: 'var(--text-main)'}}>@{handle}</Link>
            )}
          </div>
        </nav>
        <main className="max-w-2xl mx-auto">{children}</main>
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex justify-around py-3 z-50">
          <Link href="/feed" className="flex flex-col items-center text-[var(--text-muted)] hover:text-[#E76F51]"><span className="text-xl">🌐</span><span className="text-[0.6rem] font-bold font-mono">Réseau</span></Link>
          <Link href="/seal" className="flex flex-col items-center text-[var(--text-muted)] hover:text-[#E76F51]"><span className="text-xl">✍️</span><span className="text-[0.6rem] font-bold font-mono">Sceller</span></Link>
          <Link href="/verify" className="flex flex-col items-center text-[var(--text-muted)] hover:text-[#E76F51]"><span className="text-xl">🔍</span><span className="text-[0.6rem] font-bold font-mono">Vérifier</span></Link>
          <Link href="/messages" className="flex flex-col items-center text-[var(--text-muted)] hover:text-[#E76F51]"><span className="text-xl">💬</span><span className="text-[0.6rem] font-bold font-mono">Messages</span></Link>
          <Link href="/profil" className="flex flex-col items-center text-[var(--text-muted)] hover:text-[#E76F51]"><span className="text-xl">👤</span><span className="text-[0.6rem] font-bold font-mono">Profil</span></Link>
        </div>
      </body>
    </html>
  )
}
