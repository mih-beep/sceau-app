#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/2 → Mise à jour du Feed (Prévisualisation intelligente)"

python3 - << 'PYEOF'
import sys
p = 'src/app/feed/page.tsx'
s = open(p, encoding='utf-8').read()

if "const getFileType =" not in s:
    s = s.replace(
        "export default function Feed() {",
        """function getFileType(url: string) {
  if (!url) return 'none';
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

export default function Feed() {"""
    )

old_card = """      ) : (
        <div className="grid gap-6 mb-10">
          {seals.filter(s => !s.is_ephemeral).map((seal) => (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{seal.title}</h2>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-2">Par @{seal.author} • {seal.category}</p>
              <p className="text-sm text-[var(--text-muted)] italic line-clamp-2">{seal.description}</p>
            </div>
          ))}
        </div>
      )}"""

new_card = """      ) : (
        <div className="grid gap-6 mb-10">
          {seals.filter(s => !s.is_ephemeral).map((seal) => {
            const fileType = seal.is_hosted && seal.file_path ? getFileType(seal.file_path) : 'none';
            
            return (
            <div key={seal.id} onClick={() => setSelectedSeal(seal)} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm cursor-pointer hover:shadow-md transition overflow-hidden flex flex-col">
              
              {seal.is_hosted && seal.file_path && (
                <div className="w-full h-48 bg-[var(--bg-main)] relative flex items-center justify-center overflow-hidden border-b border-[var(--border-color)]">
                  {fileType === 'image' && <img src={seal.file_path} alt={seal.title} className="w-full h-full object-cover" />}
                  {fileType === 'video' && (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      <video src={seal.file_path} className="w-full h-full object-cover opacity-50" />
                      <div className="absolute text-white text-3xl opacity-80">▶</div>
                    </div>
                  )}
                  {fileType === 'pdf' && (
                    <div className="flex flex-col items-center justify-center text-[#E76F51]">
                      <div className="text-5xl mb-2">📄</div>
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--text-main)]">Document PDF</span>
                    </div>
                  )}
                  {fileType === 'other' && (
                    <div className="flex flex-col items-center justify-center text-[#4A90C2]">
                      <div className="text-5xl mb-2">📎</div>
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--text-main)]">Fichier joint</span>
                    </div>
                  )}
                  {fileType === 'audio' && (
                    <div className="flex flex-col items-center justify-center text-[#5D7A3A]">
                      <div className="text-5xl mb-2">🎵</div>
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--text-main)]">Fichier Audio</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{seal.title}</h2>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-2 font-mono">Par @{seal.author} • {seal.category}</p>
                <p className="text-sm text-[var(--text-muted)] italic line-clamp-2 mt-auto">{seal.description}</p>
              </div>
            </div>
          )})}
        </div>
      )}"""

if old_card in s:
    s = s.replace(old_card, new_card)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Feed mis à jour (aperçus intelligents)')
else:
    print('  ⚠️ Impossible de trouver le bloc de rendu du feed.')
PYEOF

say "2/2 → Mise à jour de la Visionneuse de Stories"

python3 - << 'PYEOF'
import sys
p = 'src/app/feed/page.tsx'
s = open(p, encoding='utf-8').read()

old_story = """             {stories[activeStoryIndex].file_path && stories[activeStoryIndex].is_hosted ? (
                <img src={stories[activeStoryIndex].file_path} alt="story" className="max-h-[70vh] rounded-xl object-contain" />
             ) : (
                <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border-4 border-[#E76F51] max-w-sm w-full">
                  <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>{stories[activeStoryIndex].title}</h2>
                  <p className="text-[var(--text-muted)] italic">Sceau éphémère de @{stories[activeStoryIndex].author}</p>
                </div>
             )}"""

new_story = """             {(() => {
                const story = stories[activeStoryIndex];
                const type = story.file_path ? getFileType(story.file_path) : 'none';

                if (type === 'image') {
                  return <img src={story.file_path} alt="story" className="max-h-[70vh] rounded-xl object-contain" />;
                }
                if (type === 'video') {
                  return <video src={story.file_path} controls autoPlay playsInline className="max-h-[70vh] rounded-xl object-contain" />;
                }
                if (type === 'audio') {
                  return (
                    <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border-4 border-[#E76F51] max-w-sm w-full text-center">
                      <div className="text-6xl mb-4 text-[#5D7A3A]">🎵</div>
                      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>{story.title}</h2>
                      <audio src={story.file_path} controls className="w-full mt-4" />
                    </div>
                  );
                }
                return (
                  <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border-4 border-[#E76F51] max-w-sm w-full text-center flex flex-col items-center">
                    <div className="text-6xl mb-4 text-[#4A90C2]">{type === 'pdf' ? '📄' : '📎'}</div>
                    <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>{story.title}</h2>
                    {type !== 'none' ? (
                      <a href={story.file_path} target="_blank" rel="noopener noreferrer" className="mt-4 bg-[#E76F51] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-[#C75A22] transition">
                        Ouvrir le document
                      </a>
                    ) : (
                      <p className="text-[var(--text-muted)] italic mt-2">Sceau éphémère de @{story.author}</p>
                    )}
                  </div>
                );
             })()}"""

if old_story in s:
    s = s.replace(old_story, new_story)
    open(p, 'w', encoding='utf-8').write(s)
    print('  ✓ Visionneuse de Stories sécurisée (vidéo, pdf, audio)')
else:
    print('  ⚠️ Impossible de trouver la visionneuse de stories.')
PYEOF

echo ""
echo -e "${GREEN}✅ Le Feed et les Stories sont maintenant blindés !${NC}"