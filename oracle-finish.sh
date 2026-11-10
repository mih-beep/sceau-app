#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Création du dossier et de la page /oracle"

mkdir -p "src/app/oracle"
cat > "src/app/oracle/page.tsx" << 'EOF'
'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  captures?: number;
};

export default function OraclePage() {
  const [url, setUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pubkey = typeof window !== 'undefined' ? localStorage.getItem('sceau_pubkey') : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function ask() {
    if (!url.trim() || !question.trim()) return;
    if (!pubkey) { setError('Connecte-toi pour utiliser Oracle.'); return; }

    setError('');
    const userMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/oracle/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, url: url.trim(), question }),
      });

      const d = await res.json();

      if (!res.ok) {
        setError(d.error || 'Erreur');
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${d.error}` }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: d.answer,
          sources: d.sources,
          captures: d.captures_used,
        }]);
      }
    } catch (e: any) {
      setError('Erreur réseau');
    }
    setLoading(false);
  }

  return (
    <div className="p-6 pb-32 md:pb-6 max-w-3xl mx-auto font-sans w-full min-h-screen flex flex-col">
      
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold font-serif" style={{color: 'var(--text-main)'}}>SCEAU Oracle</h1>
          <span className="text-[0.6rem] bg-[#F0F6FC] text-[#2D6A9E] border border-[#C9D8E8] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded">
            Beta
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Posez une question sur le contenu observé d'un site public.
          Oracle ne dit pas ce qui est vrai — il dit ce qu'il a vu, quand, et avec quelle preuve.
        </p>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 mb-4 shadow-sm">
        <label className="text-[0.65rem] font-mono font-bold uppercase text-[var(--text-muted)] block mb-2">
          URL à interroger
        </label>
        <input 
          type="url"
          placeholder="https://exemple.com"
          className="w-full border-2 border-[var(--border-color)] p-3 rounded-xl bg-transparent outline-none focus:border-[#4A90C2] text-sm"
          style={{color: 'var(--text-main)'}}
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
        />
        <p className="text-[0.65rem] text-[var(--text-muted)] mt-2 italic">
          🔒 Uniquement les sites publics en HTTPS. Respect de robots.txt.
        </p>
      </div>

      <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 mb-4 shadow-sm overflow-y-auto min-h-[400px] max-h-[60vh]">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔮</div>
            <h3 className="font-bold mb-2" style={{color: 'var(--text-main)'}}>Posez votre première question</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mb-6">
              Exemples : "Quel est le prix actuel ?" · "Qu'est-ce qui a changé depuis 3 mois ?"
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md mx-auto">
              {[
                'Quel est le prix affiché ?',
                'Quels sont les horaires ?',
                'Quelle est la date de la dernière mise à jour ?',
                'Quels sont les produits disponibles ?',
              ].map((sugg, i) => (
                <button
                  key={i}
                  onClick={() => setQuestion(sugg)}
                  className="text-left text-xs p-3 rounded-lg border border-[var(--border-color)] hover:border-[#E76F51] transition"
                  style={{color: 'var(--text-main)'}}
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                  m.role === 'user' 
                    ? 'bg-[#1A1513] text-white rounded-br-sm' 
                    : 'bg-[var(--bg-main)] border border-[var(--border-color)] rounded-bl-sm'
                }`}>
                  <p className={m.role === 'user' ? '' : 'leading-relaxed'} style={m.role === 'assistant' ? {color: 'var(--text-main)'} : {}}>
                    {m.content}
                  </p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                      <p className="text-[0.6rem] font-mono font-bold uppercase text-[var(--text-muted)] mb-1">
                        Sources ({m.captures} capture{m.captures && m.captures > 1 ? 's' : ''})
                      </p>
                      <div className="space-y-1">
                        {m.sources.map((s: any, j: number) => (
                          <div key={j} className="text-[0.65rem] font-mono text-[var(--text-muted)]">
                            • {new Date(s.date).toLocaleString('fr-FR')} 
                            {s.is_live && <span className="ml-1 text-[#3F8F5C]">(live)</span>}
                            <span className="text-[0.55rem] block">Hash : {s.hash_short}...</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl rounded-bl-sm p-4">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                    <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3 shadow-sm">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={url ? 'Posez votre question...' : "Renseignez d'abord une URL ci-dessus"}
            className="flex-1 bg-transparent border-2 border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#E76F51] text-sm"
            style={{color: 'var(--text-main)'}}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && ask()}
            disabled={loading || !url.trim()}
          />
          <button
            onClick={ask}
            disabled={loading || !url.trim() || !question.trim()}
            className="bg-[#E76F51] text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 hover:bg-[#C75A22] transition shrink-0"
          >
            {loading ? '...' : '→'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 font-bold mt-2">{error}</p>}
        <p className="text-[0.6rem] text-[var(--text-muted)] mt-2 italic">
          💡 Oracle sépare le fait (contenu observé + empreinte) de la lecture (résumé IA).
        </p>
      </div>

      <div className="mt-4 text-center">
        <Link href="/archive" className="text-xs font-bold text-[#4A90C2] hover:underline">
          ← Surveiller un site avec SCEAU Archive
        </Link>
      </div>
    </div>
  );
}
EOF
echo "  ✓ Page /oracle créée"

say "2/2 → Build final"
rm -rf .next
npm run build

echo ""
echo -e "${GREEN}✅ Oracle prêt !${NC}"
