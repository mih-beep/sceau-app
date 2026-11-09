#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

# ==========================================================
# 1. S'assurer que l'API du Feed Global existe
# ==========================================================
say "1/2 → Vérification de l'API globale"
mkdir -p "src/app/api/creations/global"
cat > "src/app/api/creations/global/route.ts" << 'EOF'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT a.id, a.type, a.content, a.media_url, a.created_at, 
             u.handle as author,
             s.id as seal_id, s.title as seal_title
      FROM attachments a 
      JOIN users u ON a.user_id = u.id
      JOIN seals s ON a.seal_id = s.id
      WHERE a.parent_id IS NULL 
      ORDER BY RANDOM() 
      LIMIT 50
    `);
    return NextResponse.json({ creations: result.rows });
  } catch (e) {
    console.error('[creations/global]', e);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
EOF

# ==========================================================
# 2. Patcher src/app/feed/page.tsx
# ==========================================================
say "2/2 → Mise à jour de src/app/feed/page.tsx"

python3 - << 'PYEOF'
import sys

p = 'src/app/feed/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier feed/page.tsx introuvable')

# A. Ajouter les states
old_states = """  const [creations, setCreations] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreationsFeed, setShowCreationsFeed] = useState(false);"""

new_states = """  const [creations, setCreations] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Feed Global
  const [showCreationsFeed, setShowCreationsFeed] = useState(false);
  const [globalCreations, setGlobalCreations] = useState<any[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  // Modale de création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createContent, setCreateContent] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);"""
if old_states not in s: sys.exit('  ✗ States introuvables')
s = s.replace(old_states, new_states)

# B. Ajouter le useEffect de chargement du feed global
old_effect = """  useEffect(() => {
    if (selectedSeal) loadCreations(selectedSeal.id);
  }, [selectedSeal]);"""

new_effect = """  useEffect(() => {
    if (selectedSeal) loadCreations(selectedSeal.id);
  }, [selectedSeal]);

  const loadGlobalFeed = () => {
    setLoadingGlobal(true);
    fetch('/api/creations/global')
      .then(r => r.json())
      .then(d => { setGlobalCreations(d.creations || []); setLoadingGlobal(false); })
      .catch(() => setLoadingGlobal(false));
  };

  useEffect(() => {
    if (showCreationsFeed) loadGlobalFeed();
  }, [showCreationsFeed]);"""
if old_effect not in s: sys.exit('  ✗ useEffect introuvable')
s = s.replace(old_effect, new_effect)

# C. Ajouter la fonction submitCreation
old_submit = """  async function submitComment() {"""

new_submit = """  async function submitCreation() {
    if ((!createContent.trim() && !createFile) || !myPubkey || !selectedSeal) return;
    setIsCreating(true);

    const formData = new FormData();
    formData.append('seal_id', selectedSeal.id);
    formData.append('pubkey', myPubkey);
    formData.append('content', createContent);
    formData.append('type', createFile ? (createFile.type.startsWith('video') ? 'video' : 'image') : 'text');
    if (createFile) formData.append('file', createFile);

    await fetch('/api/creations', { method: 'POST', body: formData });
    
    setCreateContent('');
    setCreateFile(null);
    setShowCreateModal(false);
    setIsCreating(false);
    loadCreations(selectedSeal.id);
  }

  async function submitComment() {"""
if old_submit not in s: sys.exit('  ✗ submitComment introuvable')
s = s.replace(old_submit, new_submit)

# D. Remplacer le placeholder du Feed Global par la vraie UI
old_feed = """  // Si on est dans le Feed des créations (scroll infini)
  if (showCreationsFeed) {
    return (
      <div className="p-6 max-w-lg mx-auto font-sans min-h-screen bg-[var(--bg-main)]">
        <button onClick={() => setShowCreationsFeed(false)} className="mb-4 text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
          ← Retour aux Cadrans
        </button>
        <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--text-main)' }}>Créations</h1>
        <div className="space-y-6">
          {/* Ici on affichera toutes les créations mélangées dans la V2. 
              Pour l'instant on affiche un message. */}
          <p className="text-center italic text-[var(--text-muted)] py-10">Le Feed global des créations arrive bientôt...</p>
        </div>
      </div>
    );
  }"""

new_feed = """  // Si on est dans le Feed des créations (scroll infini)
  if (showCreationsFeed) {
    return (
      <div className="p-6 max-w-lg mx-auto font-sans min-h-screen bg-[var(--bg-main)] pb-20">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setShowCreationsFeed(false)} className="text-sm font-bold flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)]" style={{ color: 'var(--text-main)' }}>
            ← Retour
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Créations</h1>
        </div>

        {loadingGlobal ? (
           <p className="text-center font-mono py-10">Chargement des créations...</p>
        ) : globalCreations.length === 0 ? (
           <div className="text-center py-10 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)]">
             <p className="italic text-[var(--text-muted)]">Aucune création sur le réseau pour le moment.</p>
           </div>
        ) : (
          <div className="space-y-6">
            {globalCreations.map((c: any) => (
              <div key={c.id} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col">
                
                {/* Header de la création */}
                <div className="p-4 flex justify-between items-center border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-xs">
                      {c.author[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>@{c.author}</div>
                      <div className="text-[0.6rem] text-[var(--text-muted)]">a publié une création</div>
                    </div>
                  </div>
                </div>

                {/* Média (Image ou Vidéo) */}
                {c.media_url && (
                  <div className="w-full bg-black flex justify-center max-h-[400px] overflow-hidden">
                    {c.type === 'video' ? (
                      <video src={c.media_url} controls className="max-h-[400px] w-full object-contain" />
                    ) : (
                      <img src={c.media_url} alt="création" className="w-full object-cover max-h-[400px]" />
                    )}
                  </div>
                )}

                {/* Texte */}
                <div className="p-4">
                  {c.content && <p className="text-sm mb-4" style={{ color: 'var(--text-main)' }}>{c.content}</p>}
                  
                  {/* Lien vers le sceau fondateur */}
                  <button 
                    onClick={() => { setShowCreationsFeed(false); setSelectedSeal({ id: c.seal_id, title: c.seal_title, author: c.author, description: '' }); }}
                    className="w-full text-left bg-[var(--bg-main)] border border-[var(--border-color)] p-3 rounded-xl hover:border-[#E76F51] transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-[0.6rem] font-mono font-bold text-[var(--text-muted)] uppercase">Sceau fondateur</div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>{c.seal_title}</div>
                    </div>
                    <span className="text-[#E76F51] group-hover:translate-x-1 transition">→</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    );
  }"""
if old_feed not in s: sys.exit('  ✗ Placeholder feed introuvable')
s = s.replace(old_feed, new_feed)

# E. Modifier le bouton "Lancez la vôtre" dans le Cadran
old_btn = """                <button 
                  onClick={() => { /* Ouvre le feed de créations */ alert("Le scroll infini des créations arrive dans la prochaine mise à jour !"); }}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-[#E76F51] bg-[#FDF4F0] hover:bg-[#FCEAD6] transition group"
                >"""
new_btn = """                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-[#E76F51] bg-[#FDF4F0] hover:bg-[#FCEAD6] transition group"
                >"""
if old_btn not in s: sys.exit('  ✗ Bouton cadran introuvable')
s = s.replace(old_btn, new_btn)

# F. Ajouter la Modale de Création
old_end = """      {/* Visionneuse Stories (inchangée) */}"""

new_end = """      {/* === MODALE : CRÉER UNE CRÉATION RATTACHÉE === */}
      {showCreateModal && selectedSeal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[var(--bg-surface)] w-full max-w-md rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Nouvelle Création</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-xl opacity-50 hover:opacity-100">✕</button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">Rattacher une création au sceau : <strong>{selectedSeal.title}</strong></p>

            <textarea 
              className="w-full border-2 border-[var(--border-color)] rounded-xl p-3 outline-none bg-transparent mb-4" 
              rows={3} 
              placeholder="Écris ton commentaire ou la description de ton média..."
              value={createContent}
              onChange={e => setCreateContent(e.target.value)}
              style={{ color: 'var(--text-main)' }}
            />

            <div className="mb-6">
              <label className="block text-xs font-mono font-bold text-[var(--text-muted)] uppercase mb-2">Média (Photo ou Vidéo)</label>
              <input 
                type="file" 
                accept="image/*,video/*" 
                onChange={e => setCreateFile(e.target.files?.[0] || null)} 
                className="w-full text-sm" 
              />
              {createFile && <p className="text-xs mt-2 text-[#5D7A3A] font-bold">📎 {createFile.name}</p>}
            </div>

            <button 
              onClick={submitCreation}
              disabled={isCreating || (!createContent.trim() && !createFile)}
              className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-50 transition"
            >
              {isCreating ? 'Publication...' : 'Publier la création'}
            </button>
          </div>
        </div>
      )}

      {/* Visionneuse Stories (inchangée) */}"""
if old_end not in s: sys.exit('  ✗ Fin de composant introuvable')
s = s.replace(old_end, new_end)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ src/app/feed/page.tsx patché avec succès.')
PYEOF

echo ""
echo -e "${GREEN}✅ Tout est en place. Lance 'npm run dev' pour tester !${NC}"
