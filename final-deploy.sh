#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'; NC='\033[0m'
say() { echo -e "${GREEN}▶ $1${NC}"; }

say "1/4 → Application de la Landing Page"
cat > src/app/page.tsx << 'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [latestSeals, setLatestSeals] = useState<any[]>([]);
  const [isLogged, setIsLogged] = useState(false);

  useEffect(() => {
    const handle = localStorage.getItem('sceau_handle');
    if (handle) setIsLogged(true);
    fetch('/api/feed').then(res => res.json()).then(data => setLatestSeals((data.seals || []).slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] font-sans">
      <nav className="w-full border-b border-[var(--border-color)] bg-[var(--bg-surface)] py-4 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-3xl font-bold font-serif text-[var(--text-main)] tracking-tight">SCEAU<span className="text-[#E76F51]">.</span></Link>
          <div className="flex items-center gap-4">
            {isLogged ? (
              <Link href="/feed" className="bg-[#1A1513] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-black transition">Accéder à mon espace</Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition hidden sm:block">Se connecter</Link>
                <Link href="/signup" className="bg-[#E76F51] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-[#C75A22] transition">Créer un compte</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-2 bg-white border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-mono font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500"></span> L'infrastructure de preuve du 21ème siècle
        </span>
        <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 leading-[1.1] tracking-tight text-[var(--text-main)]">
          Prouvez que vous l'avez<br/>créé <span className="text-[#E76F51] italic">en premier.</span>
        </h1>
        <p className="text-lg md:text-xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
          SCEAU est le protocole universel de preuve. Scellez vos fichiers, vos contrats et vos idées en un clic. La preuve est gravée sur la blockchain Bitcoin. Pour toujours.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup" className="bg-[#1A1513] text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-black transition">Sceller mon premier fichier</Link>
          <Link href="/verify" className="bg-[var(--bg-surface)] border-2 border-[var(--border-color)] text-[var(--text-main)] px-8 py-4 rounded-xl font-bold text-lg hover:border-[#E76F51] transition">Vérifier une preuve</Link>
        </div>
      </section>

      <section className="py-20 px-6 bg-[var(--bg-surface)] border-y border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-serif text-[var(--text-main)] mb-4">Un bouclier pour chaque créateur.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Freelances & Créatifs</h3>
              <p className="text-sm text-[var(--text-muted)]">Ne vous faites plus voler vos livrables. Prouvez l'antériorité de vos designs, codes ou textes.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Entreprises & Agences</h3>
              <p className="text-sm text-[var(--text-muted)]">Sécurisez vos contrats et votre code. Scellez automatiquement chaque commit avec GitHub.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Institutions & Journalistes</h3>
              <p className="text-sm text-[var(--text-muted)]">Archivez la vérité. Détectez les modifications de sites web et prouvez l'intégrité de vos dossiers.</p>
            </div>
            <div className="bg-[var(--bg-main)] p-6 rounded-2xl border border-[var(--border-color)] hover:border-[#E76F51] transition">
              <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Grand Public</h3>
              <p className="text-sm text-[var(--text-muted)]">Scellez vos souvenirs, créez des capsules temporelles, ou faites des "tope là" numériques.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] py-8 text-center">
        <p className="text-sm text-[var(--text-muted)] font-mono">SCEAU © {new Date().getFullYear()} — Le notaire de poche du web.</p>
      </footer>
    </div>
  );
}
EOF

say "2/4 → Corrections Mobiles & Profil"
python3 - << 'PYEOF'
import sys, os

# Fix Profil @
p1 = 'src/app/api/profil/route.ts'
if os.path.exists(p1):
    s1 = open(p1, encoding='utf-8').read()
    s1 = s1.replace("user = await pool.query(\"SELECT id, handle, bio, role, is_pro, open_to_collaboration, first_name, last_name, birth_date FROM users WHERE LOWER(handle) = LOWER($1)\", [handleParam]);", "user = await pool.query(\"SELECT id, handle, bio, role, is_pro, open_to_collaboration, first_name, last_name, birth_date FROM users WHERE LOWER(handle) = LOWER($1)\", [handleParam.replace('@', '').trim()]);")
    open(p1, 'w', encoding='utf-8').write(s1)

# Fix Atelier Padding
p2 = 'src/app/seal/page.tsx'
if os.path.exists(p2):
    s2 = open(p2, encoding='utf-8').read()
    s2 = s2.replace('<div className="p-6 font-sans max-w-md md:max-w-4xl mx-auto w-full">', '<div className="p-6 pb-32 font-sans max-w-md md:max-w-4xl mx-auto w-full">')
    open(p2, 'w', encoding='utf-8').write(s2)

# Fix Stories
p3 = 'src/app/feed/page.tsx'
if os.path.exists(p3):
    s3 = open(p3, encoding='utf-8').read()
    old_story = """{story.file_path && story.is_hosted ? <img src={story.file_path} alt="story" className="w-full h-full object-cover" /> : <span className="opacity-70">{story.author[0].toUpperCase()}</span>}"""
    new_story = """{story.file_path && story.is_hosted ? (<img src={story.file_path} alt="story" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />) : null}<span className="opacity-70 absolute inset-0 flex items-center justify-center bg-[var(--bg-main)]" style={{ display: story.file_path && story.is_hosted ? 'none' : 'flex' }}>{story.author[0].toUpperCase()}</span>"""
    s3 = s3.replace(old_story, new_story)
    open(p3, 'w', encoding='utf-8').write(s3)
PYEOF

say "3/4 → Nettoyage cache et Build"
rm -rf .next
npm run build

say "4/4 → Envoi sur GitHub"
git add .
git commit -m "feat: lancement officiel - Landing Page, fixes mobiles, profil et stories" || echo "Rien à commit"
git push origin main

echo ""
echo -e "${GREEN}✅ TOUT EST DEPLOYÉ ! Va sur Vercel pour voir le résultat.${NC}"
