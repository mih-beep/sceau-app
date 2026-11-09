'use client';
import './globals.css'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Cockpit from '@/components/Cockpit'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [handle, setHandle] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Enregistrement PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
    }

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

  const isActive = (path: string) => pathname === path;

  // Structure professionnelle de la navigation
  const navSections = [
    {
      title: 'Espace Public',
      links: [
        { name: 'Le Flux', path: '/feed' },
        { name: "L'Atelier", path: '/seal' },
      ]
    },
    {
      title: 'Espace Pro',
      links: [
        { name: 'Projets & Preuves', path: '/profil' },
        { name: 'Vérification', path: '/verify' },
        { name: 'Messagerie & Pactes', path: '/messages' },
      ]
    },
    {
      title: 'Réseau',
      links: [
        { name: 'Communauté', path: '/friends' },
      ]
    }
  ];

  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#E76F51" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      
      <body className="h-screen overflow-hidden flex bg-[var(--bg-main)] font-sans">
        
        {/* SIDEBAR GAUCHE - DESIGN CABINET B2B */}
        <aside className="hidden md:flex flex-col w-64 bg-[#1A1513] text-[#EADFD4] border-r border-[#332824] shrink-0">
          <div className="p-8 pb-4">
            <Link href="/feed" className="text-3xl font-bold font-serif text-white tracking-wide">SCEAU<span className="text-[#E76F51]">.</span></Link>
            <div className="text-[0.6rem] font-mono tracking-widest uppercase mt-2 text-[#8A7A72]">Notaire de Poche</div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-6 px-4">
            {navSections.map(section => (
              <div key={section.title} className="mb-8">
                <div className="px-4 text-[0.65rem] font-bold uppercase tracking-wider text-[#8A7A72] mb-3">{section.title}</div>
                {section.links.map(link => (
                  <Link key={link.path} href={link.path} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors border-l-2 mb-1 ${isActive(link.path) ? 'bg-white/5 text-white border-[#E76F51]' : 'border-transparent text-[#EADFD4] hover:bg-white/5 hover:text-white'}`}>
                    {link.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="p-6 border-t border-[#332824]">
            <Link href="/profil" className="flex items-center gap-3 hover:opacity-80 transition group">
              <div className="w-8 h-8 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {handle ? handle[0].toUpperCase() : '?'}
              </div>
              <div>
                <p className="text-sm font-bold text-white group-hover:text-[#E76F51] transition-colors">@{handle || 'Invité'}</p>
                <p className="text-[0.65rem] text-[#8A7A72]">Paramètres du compte</p>
              </div>
            </Link>
          </div>
        </aside>

        {/* CONTENEUR PRINCIPAL */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* NAV TOP MOBILE */}
          <nav className="md:hidden bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center shrink-0">
            <Link href="/feed" className="text-2xl font-bold font-serif" style={{color: 'var(--text-main)'}}>SCEAU<span className="text-[#E76F51]">.</span></Link>
            <div className="flex items-center gap-4">
              <button onClick={toggleTheme} className="text-sm font-bold text-[var(--text-muted)]">{isDark ? 'Mode Clair' : 'Mode Sombre'}</button>
              {!handle ? (
                <Link href="/signup" className="text-sm font-bold bg-[#E76F51] text-white px-4 py-2 rounded-lg">S'inscrire</Link>
              ) : (
                <Link href="/profil" className="text-sm font-bold" style={{color: 'var(--text-main)'}}>@{handle}</Link>
              )}
            </div>
          </nav>

          {/* ZONE DE CONTENU */}
          <main className="flex-1 overflow-y-auto w-full pb-24 md:pb-0">
             <div className="w-full h-full">
               {children}
             </div>
          </main>

          {/* NAV BOTTOM MOBILE */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex justify-around py-3 z-50 text-[0.65rem] font-bold font-mono">
            <Link href="/feed" className={isActive('/feed') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}>Flux</Link>
            <Link href="/friends" className={isActive('/friends') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}>Réseau</Link>
            <Link href="/seal" className={isActive('/seal') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}>Atelier</Link>
            <Link href="/messages" className={isActive('/messages') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}>Messages</Link>
            <Link href="/profil" className={isActive('/profil') ? 'text-[#E76F51]' : 'text-[var(--text-muted)]'}>Profil</Link>
          </div>
        </div>

        {/* COCKPIT - Toujours visible sur Desktop */}
        <Cockpit />

      </body>
    </html>
  )
}
