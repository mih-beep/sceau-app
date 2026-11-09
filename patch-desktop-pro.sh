#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. Création du composant Cockpit (Colonne de droite)
# ==========================================================
say "1/3 → Création du Cockpit (Colonne 3 Desktop)"

mkdir -p src/components
cat > src/components/Cockpit.tsx << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Cockpit() {
  const [handle, setHandle] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const h = localStorage.getItem('sceau_handle');
    setHandle(h);
    // Simulation d'alertes pour le design (à brancher sur l'API plus tard)
    if (h) {
      setAlerts([
        { id: 1, text: '@client_X a téléchargé "Portfolio.pdf"', time: 'il y a 2 min', icon: '⬇️', urgent: false },
        { id: 2, text: '@Inconnu (compte de 1h) a vu votre projet', time: 'il y a 15 min', icon: '⚠️', urgent: true },
        { id: 3, text: '@Agence_Y a signé le Pacte de co-création', time: 'il y a 1h', icon: '🤝', urgent: false },
      ]);
    }
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-[340px] bg-[var(--bg-main)] border-l border-[var(--border-color)] h-full overflow-y-auto shrink-0">
      
      {/* BLOC 1 : STATUT & QUOTAS */}
      <div className="p-6 border-b border-[var(--border-color)]">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">Mon Espace Pro</h3>
        
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm mb-4">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-bold text-[var(--text-main)]">Stockage Cloud</span>
            <span className="text-xs font-mono text-[var(--text-muted)]">45 Go / 100 Go</span>
          </div>
          <div className="w-full bg-[var(--border-color)] rounded-full h-2 mb-4 overflow-hidden">
            <div className="bg-[#4A90C2] h-2 rounded-full" style={{ width: '45%' }}></div>
          </div>
          
          <div className="flex justify-between text-xs">
            <div>
              <p className="font-bold text-[var(--text-main)]">12</p>
              <p className="text-[var(--text-muted)]">Sceaux ce mois</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[var(--text-main)]">Projet Actif</p>
              <p className="text-[var(--orange)] cursor-pointer hover:underline">Refonte V3 →</p>
            </div>
          </div>
        </div>
      </div>

      {/* BLOC 2 : JOURNAL D'ACCÈS (Traqueur) */}
      <div className="p-6 border-b border-[var(--border-color)] flex-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">Traqueur d'accès</h3>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>

        <div className="space-y-4">
          {!handle ? (
            <p className="text-xs text-[var(--text-muted)] italic">Connectez-vous pour voir l'activité.</p>
          ) : alerts.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic">Aucun accès récent.</p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className={`p-3 rounded-xl border ${alert.urgent ? 'bg-[#FDF4F0] border-[#FCE0D6]' : 'bg-[var(--bg-surface)] border-[var(--border-color)]'}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{alert.icon}</span>
                  <div>
                    <p className={`text-xs font-bold ${alert.urgent ? 'text-[#C44A2E]' : 'text-[var(--text-main)]'}`}>{alert.text}</p>
                    <p className="text-[0.65rem] text-[var(--text-muted)] mt-1">{alert.time}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {handle && (
          <button className="w-full mt-4 text-xs font-bold text-[#4A90C2] hover:underline">
            Voir tout le journal des accès
          </button>
        )}
      </div>

      {/* BLOC 3 : PLAN DE TRAVAIL */}
      <div className="p-6 bg-[var(--bg-surface)] border-t border-[var(--border-color)]">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">À faire</h3>
        <div className="space-y-2 mb-6">
          <Link href="/messages" className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-main)] transition group">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤝</span>
              <span className="text-sm font-bold text-[var(--text-main)]">2 Pactes en attente</span>
            </div>
            <span className="text-[var(--text-muted)] group-hover:text-[var(--orange)]">→</span>
          </Link>
          
          <Link href="/settings" className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-main)] transition group">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔌</span>
              <span className="text-sm font-bold text-[var(--text-main)]">Connecter un plugin</span>
            </div>
            <span className="text-[var(--text-muted)] group-hover:text-[var(--orange)]">→</span>
          </Link>
        </div>

        <div className="bg-gradient-to-br from-[#2D2421] to-black p-4 rounded-xl text-center shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-white font-bold text-sm mb-1">SCEAU PRO</p>
            <p className="text-[0.65rem] text-gray-400 mb-3">Débloquez l'illimité.</p>
            <Link href="/pricing" className="inline-block bg-[var(--orange)] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[var(--orange-hover)] transition">
              Mettre à niveau
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
EOF

# ==========================================================
# 2. Mise à jour du Layout Principal (Gestion Desktop/Mobile)
# ==========================================================
say "2/3 → Réécriture du Layout (Séparation Desktop / Mobile)"

cat > src/app/layout.tsx << 'EOF'
'use client';
import './globals.css'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Manifeste from '@/components/Manifeste'
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
  const showManifeste = ['/profil', '/seal', '/verify', '/settings'].includes(pathname);

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
             {showManifeste && <div className="max-w-3xl mx-auto md:max-w-none"><Manifeste /></div>}
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
        <Cockpit />

      </body>
    </html>
  )
}
EOF

# ==========================================================
# 3. Adaptation des pages pour prendre toute la largeur
# ==========================================================
say "3/3 → Adaptation des pages principales au centre"

python3 - << 'PYEOF'
import os

pages_to_fix = {
    'src/app/feed/page.tsx': ('<main className="min-h-screen p-6 font-sans max-w-3xl mx-auto relative">', '<main className="min-h-screen p-6 font-sans max-w-3xl md:max-w-5xl mx-auto relative w-full">'),
    'src/app/seal/page.tsx': ('<div className="p-6 font-sans max-w-md mx-auto">', '<div className="p-6 font-sans max-w-md md:max-w-4xl mx-auto w-full">'),
    'src/app/messages/page.tsx': ('<div className="p-4 md:p-6 h-[calc(100vh-140px)] flex gap-4 font-serif max-w-5xl mx-auto relative">', '<div className="p-4 md:p-6 flex gap-4 font-serif w-full max-w-5xl md:max-w-none mx-auto relative h-full">'),
    'src/app/verify/page.tsx': ('<div className="p-6 max-w-2xl mx-auto font-sans">', '<div className="p-6 max-w-2xl md:max-w-5xl mx-auto font-sans w-full">'),
    'src/app/profil/page.tsx': ('<div className="p-6 max-w-2xl mx-auto font-serif relative">', '<div className="p-6 max-w-2xl md:max-w-5xl mx-auto font-serif relative w-full">'),
    'src/app/settings/page.tsx': ('<div className="p-6 max-w-2xl mx-auto font-sans">', '<div className="p-6 max-w-2xl md:max-w-4xl mx-auto font-sans w-full">'),
}

for path, (old, new) in pages_to_fix.items():
    if os.path.exists(path):
        s = open(path, encoding='utf-8').read()
        if old in s:
            s = s.replace(old, new)
            open(path, 'w', encoding='utf-8').write(s)
            print(f'  ✓ {path} adapté')
        else:
            print(f'  ⚠️ Pattern introuvable dans {path}')

PYEOF

echo ""
echo -e "${GREEN}✅ Architecture Desktop Pro déployée.${NC}"
