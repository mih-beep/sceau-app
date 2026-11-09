'use client';
import './globals.css'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
// import Manifeste from '@/components/Manifeste'
import Cockpit from '@/components/Cockpit'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [handle, setHandle] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    setHandle(localStorage.getItem('sceau_handle'));
    const theme = localStorage.getItem('sceau_theme');
    if (theme === 'dark') { setIsDark(true); document.documentElement.classList.add('dark'); }
  }, [pathname]);

  useEffect(() => {
    if (!handle) return;
    const fetchNotifs = () => {
      fetch(`/api/notifications?me=${handle}`).then(r => r.json()).then(d => {
        setNotifications(d.notifications || []);
        setUnread(d.unread || 0);
      });
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [handle]);

  const toggleTheme = () => {
    const next = !isDark; setIsDark(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('sceau_theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('sceau_theme', 'light'); }
  };

  const markAsRead = () => {
    if (unread > 0 && handle) {
      fetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ me: handle }) });
      setUnread(0);
    }
  };

  const isActive = (path: string) => pathname === path;
  const isToolsActive = pathname === '/seal' || pathname === '/verify';
  // const showManifeste = ['/profil', '/seal', '/verify', '/settings'].includes(pathname);

  // Liens de la sidebar Desktop
  const navLinks = [
    { name: 'Le Feed Global', path: '/feed', icon: '🌐', section: 'Espace Public' },
    { name: "L'Atelier", path: '/seal', icon: '🛠️', section: 'Espace Public' },
    { name: 'Projets (Merkle)', path: '/profil', icon: '📁', section: 'Mon Espace Pro' },
    { name: 'Vérifier', path: '/verify', icon: '🔍', section: 'Mon Espace Pro' },
    { name: 'Accords & Messages', path: '/messages', icon: '🤝', section: 'Mon Espace Pro' },
    { name: 'Communauté', path: '/friends', icon: '👥', section: 'Réseau' },
  ];

  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#E76F51" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      
      <body className="h-screen overflow-hidden flex bg-[var(--bg-main)] font-sans">
        
        {/* ========================================== */}
        {/* SIDEBAR GAUCHE (Uniquement Desktop)        */}
        {/* ========================================== */}
        <aside className="hidden md:flex flex-col w-64 bg-[#1E1E1E] text-gray-300 border-r border-[#333] shrink-0">
          <div className="p-6 pb-2">
            <Link href="/feed" className="text-3xl font-bold font-serif text-white">SCEAU<span className="text-[#E76F51]">.</span></Link>
          </div>
          
          <div className="flex-1 overflow-y-auto py-6">
            {['Espace Public', 'Mon Espace Pro', 'Réseau'].map(section => (
              <div key={section} className="mb-6">
                <div className="px-6 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 mb-2">{section}</div>
                {navLinks.filter(l => l.section === section).map(link => (
                  <Link key={link.path} href={link.path} className={`flex items-center gap-3 px-6 py-3 font-medium transition border-l-[3px] ${isActive(link.path) ? 'bg-[#E76F51]/10 text-[#E76F51] border-[#E76F51]' : 'border-transparent hover:bg-[#2D2D2D] hover:text-white'}`}>
                    <span className="text-xl">{link.icon}</span> {link.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-[#333] bg-[#151515]">
            <Link href="/profil" className="flex items-center gap-3 hover:opacity-80 transition">
              <div className="w-9 h-9 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold">
                {handle ? handle[0].toUpperCase() : '?'}
              </div>
              <div>
                <p className="text-sm font-bold text-white">@{handle || 'Invité'}</p>
                <p className="text-[0.65rem] text-gray-400">Paramètres & Profil</p>
              </div>
            </Link>
          </div>
        </aside>

        {/* ========================================== */}
        {/* CONTENEUR PRINCIPAL (Centre)               */}
        {/* ========================================== */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* NAV TOP (Uniquement Mobile) */}
          <nav className="md:hidden bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center shrink-0">
            <Link href="/feed" className="text-2xl font-bold tracking-tight font-serif" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51]">.</span></Link>
            <div className="flex items-center gap-4">
              <button onClick={toggleTheme} className="text-xl">{isDark ? '☀️' : '🌙'}</button>
              {!handle ? (
                <Link href="/signup" className="text-sm font-bold bg-[#E76F51] text-white px-4 py-2 rounded-lg">S'inscrire</Link>
              ) : (
                <Link href="/profil" className="text-sm font-bold" style={{color: 'var(--text-main)'}}>@{handle}</Link>
              )}
            </div>
          </nav>

          {/* ZONE DE CONTENU (Scrollable) */}
          <main className="flex-1 overflow-y-auto w-full pb-24 md:pb-0">
             <div className="w-full h-full">
               {children}
             </div>

          </main>

          {/* NAV BOTTOM (Uniquement Mobile) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex justify-around py-3 z-50">
            <Link href="/feed" className={`flex flex-col items-center ${isActive('/feed') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}`}>
              <span className="text-xl">🌐</span><span className="text-[0.6rem] font-bold font-mono mt-1">Feed</span>
            </Link>
            <Link href="/friends" className={`flex flex-col items-center ${isActive('/friends') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}`}>
              <span className="text-xl">👥</span><span className="text-[0.6rem] font-bold font-mono mt-1">Communauté</span>
            </Link>
            <Link href="/seal" className={`flex flex-col items-center ${isToolsActive ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}`}>
              <span className="text-xl">🛠️</span><span className="text-[0.6rem] font-bold font-mono mt-1">Outils</span>
            </Link>
            <Link href="/messages" className={`flex flex-col items-center ${isActive('/messages') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}`}>
              <span className="text-xl">💬</span><span className="text-[0.6rem] font-bold font-mono mt-1">Messages</span>
            </Link>
            <Link href="/profil" className={`flex flex-col items-center ${isActive('/profil') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}`}>
              <span className="text-xl">👤</span><span className="text-[0.6rem] font-bold font-mono mt-1">Profil</span>
            </Link>
          </div>
        </div>

        {/* ========================================== */}
        {/* COCKPIT (Uniquement Desktop)               */}
        {/* ========================================== */}
        {pathname !== '/seal' && pathname !== '/messages' && <Cockpit />}

      </body>
    </html>
  )
}
