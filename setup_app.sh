#!/bin/bash
mkdir -p src/app/api/seal src/app/api/feed src/app/api/verify src/app/feed src/app/seal src/app/verify src/app/messages src/app/profil public/uploads

cat > src/app/layout.tsx << 'FIN_FICHIER'
import './globals.css'
import Link from 'next/link'

export const metadata = { title: 'SCEAU — Preuve d\'antériorité', description: 'Le réseau de la preuve.' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-[#F5E9D8] min-h-screen pb-20">
        <nav className="bg-[#FFFCF7] border-b border-[#EFE0CA] px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <Link href="/" className="text-2xl font-bold text-[#2C1810] tracking-tight" style={{fontFamily: 'Cormorant Garamond'}}>SCEAU<span className="text-[#E76F51]">.</span></Link>
          <div className="text-xl">🔔</div>
        </nav>
        <main className="max-w-2xl mx-auto">{children}</main>
        <div className="fixed bottom-0 left-0 right-0 bg-[#FFFCF7] border-t border-[#EFE0CA] flex justify-around py-3 z-50">
          <Link href="/feed" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">🌐</span><span className="text-[0.6rem] font-bold font-mono">Réseau</span></Link>
          <Link href="/seal" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">✍️</span><span className="text-[0.6rem] font-bold font-mono">Sceller</span></Link>
          <Link href="/verify" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">🔍</span><span className="text-[0.6rem] font-bold font-mono">Vérifier</span></Link>
          <Link href="/messages" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">💬</span><span className="text-[0.6rem] font-bold font-mono">Messages</span></Link>
          <Link href="/profil" className="flex flex-col items-center text-[#A89070] hover:text-[#E76F51]"><span className="text-xl">👤</span><span className="text-[0.6rem] font-bold font-mono">Profil</span></Link>
        </div>
      </body>
    </html>
  )
}
FIN_FICHIER

cat > src/app/api/seal/route.ts << 'FIN_FICHIER'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const hash = data.get('hash') as string;
    const title = data.get('title') as string;
    const description = data.get('description') as string;
    const category = data.get('category') as string;
    const isHosted = data.get('isHosted') === 'true';
    const isPublic = data.get('isPublic') === 'true';
    const pubkey = data.get('pubkey') as string;
    const file = data.get('file') as File;

    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const authorId = user.rows[0].id;

    let filePath = null;
    if (isHosted && file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) + '-' + file.name;
      const dir = join(process.cwd(), 'public/uploads');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, filename), buffer);
      filePath = '/uploads/' + filename;
    }

    const protocolRes = await fetch('http://localhost:8080/v1/seal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash, title }) });
    const protocolData = await protocolRes.json();

    await pool.query(
      "INSERT INTO seals (hash, timestamp, author_id, title, description, category, is_public, is_hosted, file_path) VALUES (decode($1, 'base64'), $2, $3, $4, $5, $6, $7, $8, $9)",
      [hash, protocolData.timestamp, authorId, title, description, category, isPublic, isHosted, filePath]
    );
    return NextResponse.json(protocolData);
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
FIN_FICHIER

cat > src/app/api/feed/route.ts << 'FIN_FICHIER'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT s.id, s.title, s.description, s.category, s.is_hosted, s.file_path, s.timestamp, s.hash, u.handle as author
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE s.is_public = TRUE ORDER BY s.created_at DESC LIMIT 50
    `);
    return NextResponse.json(result.rows);
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
FIN_FICHIER

cat > src/app/api/verify/route.ts << 'FIN_FICHIER'
import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

export async function POST(req: Request) {
  try {
    const { hash } = await req.json();
    const result = await pool.query(`
      SELECT s.title, s.timestamp, s.is_hosted, s.file_path, u.handle as author
      FROM seals s JOIN users u ON s.author_id = u.id
      WHERE encode(s.hash, 'base64') = $1
    `, [hash]);

    if (result.rows.length > 0) return NextResponse.json({ found: true, seal: result.rows[0] });
    return NextResponse.json({ found: false });
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}
FIN_FICHIER

cat > src/app/feed/page.tsx << 'FIN_FICHIER'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Feed() {
  const [seals, setSeals] = useState<any[]>([]);
  const [filter, setFilter] = useState('Tout');
  useEffect(() => { fetch('/api/feed').then(r => r.json()).then(d => setSeals(d)); }, []);
  const categories = ['Tout', '🎨 Art', '🎵 Musique', '💻 Code', '📝 Écrit'];
  const filtered = filter === 'Tout' ? seals : seals.filter(s => s.category === filter);

  return (
    <div className="p-6">
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-none">
        {categories.map(c => <button key={c} onClick={() => setFilter(c)} className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold whitespace-nowrap transition ${filter === c ? 'bg-[#2C1810] text-white' : 'bg-[#FDF8F0] text-[#A8804E] border border-[#EFE0CA]'}`}>{c}</button>)}
      </div>
      <div className="flex flex-col gap-5">
        {filtered.map(seal => (
          <div key={seal.id} className="bg-white border border-[#EFE0CA] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold">{seal.author[0].toUpperCase()}</div>
              <div><div className="font-bold text-sm">@{seal.author}</div><div className="text-[0.65rem] font-mono text-[#A89070]">{new Date(seal.timestamp).toLocaleDateString('fr-FR')}</div></div>
            </div>
            <div className="px-4 pb-2">
              <h2 className="text-xl font-bold font-serif mb-1">{seal.title}</h2>
              {seal.description && <p className="text-sm text-[#7A5A3A] italic mb-3">{seal.description}</p>}
            </div>
            {seal.is_hosted ? (
              <div className="w-full h-48 bg-[#F9EEDC] flex items-center justify-center text-4xl">🖼️</div>
            ) : (
              <div className="w-full h-24 bg-[#F0F6FC] border-y border-[#C9D8E8] flex items-center justify-center text-[#2D6A9E] font-mono text-xs">🔒 Fichier non hébergé (Preuve seule)</div>
            )}
            <div className="p-4 flex justify-between items-center">
              {seal.is_hosted ? <span className="bg-[#F5F9EE] border border-[#A8C77E] text-[#5D7A3A] px-3 py-1 rounded-lg text-[0.6rem] font-mono font-bold">📁 Hébergé</span> : <span className="bg-[#FDF8F0] border border-[#EFE0CA] text-[#A89070] px-3 py-1 rounded-lg text-[0.6rem] font-mono font-bold">🔒 Preuve seule</span>}
              <Link href={seal.is_hosted ? seal.file_path : '#'} target="_blank" className="bg-[#E76F51] text-white px-4 py-2 rounded-lg text-xs font-mono font-bold hover:bg-[#C44A2E] transition">Voir l'oeuvre</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
FIN_FICHIER

cat > src/app/seal/page.tsx << 'FIN_FICHIER'
'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Seal() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('🎨 Art');
  const [isHosted, setIsHosted] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [status, setStatus] = useState('');

  async function handleSeal() {
    if (!file || !title) return setStatus("Fichier et titre requis");
    setStatus("Calcul en cours...");
    try {
      const buffer = await file.arrayBuffer();
      const hash = sha256(new Uint8Array(buffer));
      let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
      const pubkey = localStorage.getItem('sceau_pubkey');
      if (!pubkey) return setStatus("Créez un compte d'abord !");

      const formData = new FormData();
      formData.append('hash', btoa(hashStr));
      formData.append('title', title);
      formData.append('description', desc);
      formData.append('category', cat);
      formData.append('isHosted', isHosted.toString());
      formData.append('isPublic', isPublic.toString());
      formData.append('pubkey', pubkey);
      formData.append('file', file);

      const res = await fetch('/api/seal', { method: 'POST', body: formData });
      if (res.ok) setStatus("✅ Succès ! Retrouvez-le dans le Réseau.");
      else setStatus("Erreur lors du scellement");
    } catch (e) { setStatus("Erreur système"); }
  }

  return (
    <div className="p-6">
      <div className="text-center mb-8"><h1 className="text-3xl font-bold font-serif">Gravez votre œuvre.</h1><p className="text-[#7A5A3A] italic font-serif">Choisissez comment la protéger.</p></div>
      <div className="space-y-4">
        <div><label className="text-xs font-mono font-bold text-[#A89070] uppercase">Titre</label><input type="text" className="w-full border-2 border-[#EFE0CA] focus:border-[#E76F51] rounded-xl p-3 outline-none" value={title} onChange={e=>setTitle(e.target.value)} /></div>
        <div><label className="text-xs font-mono font-bold text-[#A89070] uppercase">Description</label><textarea className="w-full border-2 border-[#EFE0CA] focus:border-[#E76F51] rounded-xl p-3 outline-none" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} /></div>
        <div><label className="text-xs font-mono font-bold text-[#A89070] uppercase">Catégorie</label><select className="w-full border-2 border-[#EFE0CA] rounded-xl p-3 outline-none" value={cat} onChange={e=>setCat(e.target.value)}><option>🎨 Art</option><option>🎵 Musique</option><option>💻 Code</option><option>📝 Écrit</option></select></div>
        <div className="border-2 border-dashed border-[#E76F51] bg-[#FDF8F0] p-6 rounded-xl text-center cursor-pointer"><input type="file" className="w-full text-sm" onChange={e=>setFile(e.target.files?.[0]||null)} /></div>
        <div className="flex items-center gap-3 p-4 border border-[#EFE0CA] rounded-xl bg-white cursor-pointer" onClick={()=>setIsHosted(!isHosted)}>
          <input type="checkbox" checked={isHosted} readOnly className="w-5 h-5 accent-[#E76F51]" />
          <div><div className="font-mono text-xs font-bold text-[#2C1810]">Héberger le fichier</div><div className="text-xs text-[#A89070]">Stocké sur SCEAU (1 Go gratuit)</div></div>
        </div>
        <div className="flex items-center gap-3 p-4 border border-[#EFE0CA] rounded-xl bg-white cursor-pointer" onClick={()=>setIsPublic(!isPublic)}>
          <input type="checkbox" checked={isPublic} readOnly className="w-5 h-5 accent-[#E76F51]" />
          <div><div className="font-mono text-xs font-bold text-[#2C1810]">Rendre public (Feed)</div><div className="text-xs text-[#A89070]">Visible par tous</div></div>
        </div>
        <button onClick={handleSeal} className="w-full bg-gradient-to-r from-[#E76F51] to-[#F4A261] text-white p-4 rounded-xl font-bold shadow-lg">SCELLER</button>
        {status && <p className="text-center font-bold mt-4 text-[#C44A2E]">{status}</p>}
      </div>
    </div>
  );
}
FIN_FICHIER

cat > src/app/verify/page.tsx << 'FIN_FICHIER'
'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';

export default function Verify() {
  const [tab, setTab] = useState('file');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function verifyFile(file: File) {
    setLoading(true);
    const buffer = await file.arrayBuffer();
    const hash = sha256(new Uint8Array(buffer));
    let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: btoa(hashStr) }) });
    const data = await res.json(); setResult(data); setLoading(false);
  }

  async function verifyHash(input: string) {
    if(!input) return; setLoading(true);
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: input }) });
    const data = await res.json(); setResult(data); setLoading(false);
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold font-serif mb-2 text-center">Vérifier.</h1>
      <p className="text-[#7A5A3A] italic font-serif mb-6 text-center">Prouvez l'authenticité.</p>
      <div className="flex bg-[#F9EEDC] p-1 rounded-xl mb-6">
        <button onClick={()=>{setTab('file');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='file'?'bg-white shadow text-[#2C1810]':'text-[#A89070]'}`}>À partir du fichier</button>
        <button onClick={()=>{setTab('hash');setResult(null)}} className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg ${tab==='hash'?'bg-white shadow text-[#2C1810]':'text-[#A89070]'}`}>À partir du Hash</button>
      </div>
      {tab === 'file' ? (
        <div className="border-2 border-dashed border-[#4A90C2] bg-[#F0F6FC] p-8 rounded-xl text-center"><input type="file" onChange={e=>e.target.files?.[0] && verifyFile(e.target.files[0])} className="w-full text-sm" /></div>
      ) : (
        <div className="space-y-4">
          <input type="text" placeholder="Collez le hash (ex: b2e7...)" className="w-full border-2 border-[#EFE0CA] p-3 rounded-xl outline-none font-mono" onChange={e=>verifyHash(e.target.value)} />
        </div>
      )}
      {loading && <p className="text-center mt-4">Recherche...</p>}
      {result && (
        <div className={`mt-6 p-6 rounded-2xl border-2 ${result.found ? 'bg-[#F5F9EE] border-[#7A9B5A]' : 'bg-[#FDF4F0] border-[#D64545]'}`}>
          {result.found ? (
            <div className="text-center">
              <div className="text-3xl mb-2">✅</div>
              <h2 className="font-bold text-lg mb-1">FICHIER AUTHENTIQUE</h2>
              <p className="text-sm mb-2">{result.seal.title} par @{result.seal.author}</p>
              {result.seal.is_hosted && <a href={result.seal.file_path} target="_blank" className="inline-block bg-[#4A90C2] text-white px-4 py-2 rounded-lg mt-2 text-xs font-bold">⬇️ Télécharger l'œuvre</a>}
            </div>
          ) : <p className="text-center font-bold">❌ Fichier inconnu.</p>}
        </div>
      )}
    </div>
  );
}
FIN_FICHIER

cat > src/app/messages/page.tsx << 'FIN_FICHIER'
export default function Messages() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold font-serif mb-6">Messages.</h1>
      <div className="space-y-4">
        {['Fatou', 'Karim', 'Sarah'].map((n, i) => (
          <div key={n} className="flex items-center gap-4 border-b border-[#EFE0CA] pb-4">
            <div className="w-12 h-12 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-bold text-xl">{n[0]}</div>
            <div className="flex-1"><div className="font-bold text-sm flex justify-between">{n} <span className="text-xs text-[#A89070] font-normal">10:42</span></div><div className="text-sm text-[#7A5A3A]">Merci pour le scellement !</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
FIN_FICHIER

cat > src/app/profil/page.tsx << 'FIN_FICHIER'
export default function Profil() {
  return (
    <div className="p-6">
      <div className="text-center mb-8"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E76F51] to-[#F4A261] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4">M</div><h1 className="text-3xl font-bold font-serif">@marie</h1><p className="text-sm font-mono text-[#A89070]">Clé : 94ac...2699</p></div>
      <div className="flex bg-[#FDF8F0] border border-[#EFE0CA] p-4 rounded-xl justify-around">
        <div className="text-center"><div className="text-2xl font-mono font-bold text-[#E76F51]">12</div><div className="text-[0.6rem] font-mono uppercase text-[#A89070]">Scellés</div></div>
        <div className="text-center"><div className="text-2xl font-mono font-bold text-[#E76F51]">5</div><div className="text-[0.6rem] font-mono uppercase text-[#A89070]">Hébergés</div></div>
        <div className="text-center"><div className="text-2xl font-mono font-bold text-[#E76F51]">45</div><div className="text-[0.6rem] font-mono uppercase text-[#A89070]">Vérifiés</div></div>
      </div>
    </div>
  );
}
FIN_FICHIER

echo "✅ Tous les fichiers ont été créés proprement !"
