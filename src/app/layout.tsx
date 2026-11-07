'use client';
import './globals.css'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Manifeste from '@/components/Manifeste'

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
  const showManifeste = ['/profil', '/seal', '/verify', '/settings'].includes(pathname);

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen pb-24 font-sans">
        <nav className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <Link href="/feed" className="text-2xl font-bold tracking-tight font-serif" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51]">.</span></Link>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="text-xl cursor-pointer">{isDark ? '☀️' : '🌙'}</button>
            
            {handle && (
              <div className="relative">
                <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAsRead(); }} className="text-xl relative">
                  🔔
                  {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[0.6rem] font-bold w-4 h-4 flex items-center justify-center rounded-full">{unread}</span>}
                </button>
                
                {showNotifs && (
                  <div className="absolute right-0 mt-4 w-72 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden z-50">
                    <div className="p-3 border-b border-[var(--border-color)] font-bold text-sm">Notifications</div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? <p className="p-4 text-center text-xs opacity-50">Aucune notification.</p> : 
                        notifications.map((n: any) => (
                          <Link key={n.id} href={n.link} onClick={() => setShowNotifs(false)} className={`block p-3 border-b border-[var(--border-color)] hover:bg-[var(--bg-main)] transition ${!n.is_read ? 'bg-[#FDF4F0]' : ''}`}>
                            <p className="text-xs" style={{color: 'var(--text-main)'}}><span className="font-bold text-[#E76F51]">@{n.actor}</span> {n.message}</p>
                            <span className="text-[0.6rem] font-mono text-[var(--text-muted)]">{new Date(n.created_at).toLocaleTimeString('fr-FR')}</span>
                          </Link>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {!handle ? (
              <div className="flex items-center gap-3">
                <Link href="/pricing" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition hidden sm:block">Tarifs</Link>
                <Link href="/signup" className="text-sm font-bold bg-[#E76F51] text-white px-4 py-2 rounded-lg">Créer un compte</Link>
              </div>
            ) : (
              <Link href="/profil" className="text-sm font-bold" style={{color: 'var(--text-main)'}}>@{handle}</Link>
            )}
          </div>
        </nav>
        
        <main className="max-w-2xl mx-auto">{children}</main>
        {showManifeste && <Manifeste />}

        <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex justify-around py-3 z-50">
          <Link href="/feed" className={`flex flex-col items-center transition ${isActive('/feed') ? 'text-[#E76F51]' : 'text-[var(--text-muted)] hover:text-[#E76F51]'}`}>
            <span className="text-xl">🌐</span><span className="text-[0.6rem] font-bold font-mono mt-1">Feed</span>
          </Link>
          <Link href="/friends" className={`flex flex-col items-center transition ${isActive('/friends') ? 'text-[#E76F51]' : 'text-[var(--text-muted)] hover:text-[#E76F51]'}`}>
            <span className="text-xl">👥</span><span className="text-[0.6rem] font-bold font-mono mt-1">Communauté</span>
          </Link>
          <Link href="/seal" className={`flex flex-col items-center transition ${isToolsActive ? 'text-[#E76F51]' : 'text-[var(--text-muted)] hover:text-[#E76F51]'}`}>
            <span className="text-xl">🛠️</span><span className="text-[0.6rem] font-bold font-mono mt-1">Outils</span>
          </Link>
          <Link href="/messages" className={`flex flex-col items-center transition ${isActive('/messages') ? 'text-[#E76F51]' : 'text-[var(--text-muted)] hover:text-[#E76F51]'}`}>
            <span className="text-xl">💬</span><span className="text-[0.6rem] font-bold font-mono mt-1">Messages</span>
          </Link>
          <Link href="/profil" className={`flex flex-col items-center transition ${isActive('/profil') ? 'text-[#E76F51]' : 'text-[var(--text-muted)] hover:text-[#E76F51]'}`}>
            <span className="text-xl">👤</span><span className="text-[0.6rem] font-bold font-mono mt-1">Profil</span>
          </Link>
        </div>
      </body>
    </html>
  )
}
