#!/usr/bin/env bash
set -e
GREEN='\0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "Mise à jour de l'Atelier (Mode Projet)"

python3 - << 'PYEOF'
import sys
p = 'src/app/seal/page.tsx'
try:
    s = open(p, encoding='utf-8').read()
except FileNotFoundError:
    sys.exit('  ✗ Fichier seal/page.tsx introuvable')

# 1. Ajouter le mode 'project' et le state pour les fichiers
s = s.replace(
    "const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio'>('file');",
    "const [mode, setMode] = useState<'file' | 'text' | 'media' | 'audio' | 'project'>('file');\n  const [projectFiles, setProjectFiles] = useState<File[]>([]);"
)

# 2. Ajouter le bouton "Projet" dans la barre de sélection
old_tabs = """            <button type="button" onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'audio' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>🎙️ Audio</button>
          </div>"""
new_tabs = """            <button type="button" onClick={() => setMode('audio')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'audio' ? 'bg-[var(--bg-surface)] shadow' : 'opacity-50'}`} style={{ color: 'var(--text-main)' }}>🎙️ Audio</button>
            <button type="button" onClick={() => setMode('project')} className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'project' ? 'bg-[#FDF4F0] text-[#C44A2E] shadow' : 'opacity-50'}`} style={{ color: mode === 'project' ? '' : 'var(--text-main)' }}>📁 Projet</button>
          </div>"""
if old_tabs in s: s = s.replace(old_tabs, new_tabs)

# 3. Ajouter l'input multi-fichiers pour le mode projet
old_file_input = """        {!isPactMode && mode === 'file' && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Fichier</label>
            <input type="file" className="w-full text-sm mt-1" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs mt-1 text-[var(--text-muted)]">📎 {file.name} ({(file.size / 1024).toFixed(0)} Ko)</p>}
          </div>
        )}"""
new_file_input = """        {!isPactMode && mode === 'file' && (
          <div>
            <label className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Fichier</label>
            <input type="file" className="w-full text-sm mt-1" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs mt-1 text-[var(--text-muted)]">📎 {file.name} ({(file.size / 1024).toFixed(0)} Ko)</p>}
          </div>
        )}
        
        {!isPactMode && mode === 'project' && (
          <div className="bg-[#FDF8F0] p-4 rounded-xl border border-[#EFE0CA]">
            <label className="text-xs font-mono font-bold uppercase block mb-2" style={{ color: '#A88620' }}>Dossier (Multi-fichiers)</label>
            <p className="text-xs text-[#A88620] mb-2 italic">SCEAU va créer un Arbre de Merkle et ancrer une seule preuve pour tout le dossier.</p>
            <input type="file" multiple className="w-full text-sm" onChange={e => setProjectFiles(Array.from(e.target.files || []))} />
            {projectFiles.length > 0 && <p className="text-xs mt-2 text-[#5D7A3A] font-bold">📎 {projectFiles.length} fichier(s) sélectionné(s)</p>}
          </div>
        )}"""
if old_file_input in s: s = s.replace(old_file_input, new_file_input)

# 4. Modifier handleSeal pour gérer le mode projet
old_handle = """  async function handleSeal() {
    setStatus('');

    if (!title.trim()) return setStatus("❌ Un titre est requis");"""
new_handle = """  async function handleSeal() {
    setStatus('');

    if (!title.trim()) return setStatus("❌ Un titre est requis");
    if (mode === 'project' && projectFiles.length === 0) return setStatus("❌ Sélectionne des fichiers pour ton projet");"""
if old_handle in s: s = s.replace(old_handle, new_handle)

# 5. Modifier sendToServer pour envoyer vers /api/projects
old_send = """    let endpoint = '/api/seal';

    if (isPactMode) {
      endpoint = '/api/pacts/create';"""
new_send = """    let endpoint = '/api/seal';

    if (mode === 'project') {
      endpoint = '/api/projects';
      formData.append('isHosted', isHosted.toString());
      projectFiles.forEach(f => formData.append('files', f));
    } else if (isPactMode) {
      endpoint = '/api/pacts/create';"""
if old_send in s: s = s.replace(old_send, new_send)

# 6. Adapter la validation et le calcul du hash avant l'envoi
old_hash = """      let hashContent: Uint8Array;

      if (isPactMode) {
        const metaString = `${title}-${desc}-${pactFiles.map(f => f.name).join(',')}`;
        hashContent = sha256(new TextEncoder().encode(metaString));
      } else if (mode === 'text') {
        hashContent = sha256(new TextEncoder().encode(textContent));
      } else {
        if (!file) return setStatus("❌ Fichier manquant");
        hashContent = sha256(new Uint8Array(await file.arrayBuffer()));
      }"""
new_hash = """      let hashContent: Uint8Array;

      if (mode === 'project') {
        // Pour un projet, le hash principal est calculé côté serveur (Merkle Root)
        hashContent = sha256(new TextEncoder().encode(title)); // Hash factice temporaire
      } else if (isPactMode) {
        const metaString = `${title}-${desc}-${pactFiles.map(f => f.name).join(',')}`;
        hashContent = sha256(new TextEncoder().encode(metaString));
      } else if (mode === 'text') {
        hashContent = sha256(new TextEncoder().encode(textContent));
      } else {
        if (!file) return setStatus("❌ Fichier manquant");
        hashContent = sha256(new Uint8Array(await file.arrayBuffer()));
      }"""
if old_hash in s: s = s.replace(old_hash, new_hash)

# 7. Ne pas oublier d'ignorer le fichier simple dans le formdata si mode projet
old_append = """      if (mode !== 'text' && file) formData.append('file', file);
      formData.append('isHosted', (!isFlashMode && isHosted).toString());
    }"""
new_append = """      if (mode !== 'text' && mode !== 'project' && file) formData.append('file', file);
      formData.append('isHosted', (!isFlashMode && isHosted).toString());
    }"""
if old_append in s: s = s.replace(old_append, new_append)

# 8. Mettre à jour la condition pour afficher les options de visibilité
old_vis = """        {!isFlashMode && !isPactMode && (
          <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 mt-4">"""
new_vis = """        {!isFlashMode && !isPactMode && mode !== 'project' && (
          <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 mt-4">"""
if old_vis in s: s = s.replace(old_vis, new_vis)

open(p, 'w', encoding='utf-8').write(s)
print('  ✓ Atelier mis à jour avec le mode Projet.')
PYEOF
