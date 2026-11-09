'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Cockpit() {
  const [handle, setHandle] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const h = localStorage.getItem('sceau_handle');
    const pubkey = localStorage.getItem('sceau_pubkey');
    setHandle(h);

    if (pubkey) {
      // Récupérer les vraies données du profil
      fetch(`/api/profil?pubkey=${encodeURIComponent(pubkey)}`)
        .then(r => r.json())
        .then(d => {
          if (d.handle) setProfile(d);
        });

      // Simuler les alertes (à brancher sur l'API journal des accès plus tard)
      setAlerts([
        { id: 1, text: '@client_X a téléchargé "Portfolio.pdf"', time: 'il y a 2 min', icon: '⬇️', urgent: false },
        { id: 2, text: '@Inconnu (compte de 1h) a vu votre projet', time: 'il y a 15 min', icon: '⚠️', urgent: true },
        { id: 3, text: '@Agence_Y a signé le Pacte de co-création', time: 'il y a 1h', icon: '🤝', urgent: false },
      ]);
    }
  }, []);

  // Calcul du vrai stockage
  const maxQuotaGB = 0.1; // 100 Mo (0.1 Go) en version Free
  const usedBytes = profile?.hosted ? profile.hosted * 1024 * 1024 : 0; // Approximation (à affiner selon la vraie API)
  const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const percentage = Math.min(100, (parseFloat(usedGB) / maxQuotaGB) * 100);

  return (
    <aside className="hidden lg:flex flex-col w-[340px] bg-[var(--bg-main)] border-l border-[var(--border-color)] h-full overflow-y-auto shrink-0">
      
      {/* BLOC 1 : STATUT & QUOTAS RÉELS */}
      <div className="p-6 border-b border-[var(--border-color)]">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">Mon Espace Pro</h3>
        
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm mb-4">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-bold text-[var(--text-main)]">Stockage</span>
            <span className="text-xs font-mono text-[var(--text-muted)]">{usedGB} Go / {maxQuotaGB} Go</span>
          </div>
          <div className="w-full bg-[var(--border-color)] rounded-full h-2 mb-4 overflow-hidden">
            <div className={`h-2 rounded-full ${percentage > 90 ? 'bg-red-500' : 'bg-[#4A90C2]'}`} style={{ width: `${percentage}%` }}></div>
          </div>
          
          <div className="flex justify-between text-xs border-t border-[var(--border-color)] pt-3">
            <div>
              <p className="font-bold text-[var(--text-main)]">{profile?.sealed || 0}</p>
              <p className="text-[var(--text-muted)]">Sceaux au total</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[var(--text-main)]">Équipe</p>
              <p className="text-[var(--orange)] cursor-pointer hover:underline">1 / 1 siège</p>
            </div>
          </div>
        </div>

        {/* NOUVEAU : Bouton Accusé de réception (Le Graal du freelance) */}
        {profile && (
          <button className="w-full bg-[#F0F6FC] border border-[#C9D8E8] text-[#2D6A9E] py-2 rounded-lg text-xs font-bold hover:bg-[#E0EDF8] transition flex items-center justify-center gap-2">
            📩 Envoyer une preuve (Accusé)
          </button>
        )}
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

      {/* BLOC 3 : PLAN DE TRAVAIL & AUDIT */}
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
          
          <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-main)] transition group">
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="text-sm font-bold text-[var(--text-main)]">Rapport d'audit PDF</span>
            </div>
            <span className="text-[var(--text-muted)] group-hover:text-[var(--orange)]">→</span>
          </button>

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
