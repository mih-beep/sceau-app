const fs = require('fs');
const path = require('path');

const files = {
  'src/db/pool.ts': `import { Pool } from 'pg';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });`,

  'src/db/schema.sql': `CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL UNIQUE,
  pubkey BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash BYTEA NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_seal UNIQUE (hash, author_id)
);`,

  'src/app/api/signup/route.ts': `import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
export async function POST(req: Request) {
  try {
    const { handle, pubkey } = await req.json();
    const result = await pool.query("INSERT INTO users (handle, pubkey) VALUES ($1, decode($2, 'base64')) RETURNING id, handle", [handle, pubkey]);
    return NextResponse.json(result.rows[0]);
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}`,

  'src/app/api/seal/route.ts': `import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
export async function POST(req: Request) {
  try {
    const { hash, title, pubkey } = await req.json();
    const user = await pool.query("SELECT id FROM users WHERE encode(pubkey, 'base64') = $1", [pubkey]);
    if (user.rows.length === 0) return NextResponse.json({ error: 'Inconnu' }, { status: 401 });
    const protocolRes = await fetch('http://localhost:8080/v1/seal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash, title }) });
    const protocolData = await protocolRes.json();
    await pool.query("INSERT INTO seals (hash, timestamp, author_id, title) VALUES (decode($1, 'base64'), $2, $3, $4)", [hash, protocolData.timestamp, user.rows[0].id, title]);
    return NextResponse.json(protocolData);
  } catch (error) { return NextResponse.json({ error: 'Erreur' }, { status: 500 }); }
}`,

  'src/app/signup/page.tsx': `'use client';
import { useState } from 'react';
import { ed25519 } from '@noble/curves/ed25519';
export default function Signup() {
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState('');
  async function handleSignup() {
    if (!handle) { setStatus("Pseudo requis"); return; }
    setStatus("Création...");
    try {
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const pubkey = ed25519.getPublicKey(secret);
      let pubkeyStr = ''; for (let i = 0; i < pubkey.length; i++) pubkeyStr += String.fromCharCode(pubkey[i]);
      let secretStr = ''; for (let i = 0; i < secret.length; i++) secretStr += String.fromCharCode(secret[i]);
      localStorage.setItem('sceau_secret', btoa(secretStr));
      localStorage.setItem('sceau_pubkey', btoa(pubkeyStr));
      const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle, pubkey: btoa(pubkeyStr) }) });
      if (res.ok) setStatus("Compte créé ! Va sur /seal"); else setStatus("Erreur");
    } catch (e) { setStatus("Erreur réseau"); }
  }
  return (<main className="p-10 max-w-md mx-auto"><h1 className="text-2xl font-bold mb-4">Créer un compte</h1><input type="text" placeholder="Pseudo" className="border p-2 w-full mb-4 text-black" value={handle} onChange={(e) => setHandle(e.target.value)} /><button onClick={handleSignup} className="bg-blue-600 text-white p-2 rounded w-full">Créer</button><p className="mt-4 font-bold text-center text-black">{status}</p></main>);
}`,

  'src/app/seal/page.tsx': `'use client';
import { useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';
export default function Seal() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  async function handleSeal() {
    if (!file || !title) { setStatus("Fichier et titre requis"); return; }
    setStatus("Calcul...");
    try {
      const buffer = await file.arrayBuffer();
      const hash = sha256(new Uint8Array(buffer));
      let hashStr = ''; for (let i = 0; i < hash.length; i++) hashStr += String.fromCharCode(hash[i]);
      const pubkey = localStorage.getItem('sceau_pubkey');
      if (!pubkey) { setStatus("Connecte-toi d'abord"); return; }
      setStatus("Envoi...");
      const res = await fetch('/api/seal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: btoa(hashStr), title, pubkey }) });
      const data = await res.json();
      if (res.ok) setStatus("Succès ! ID : " + data.seal_id.slice(0, 8)); else setStatus("Erreur");
    } catch (e) { setStatus("Erreur système"); }
  }
  return (<main className="p-10 max-w-md mx-auto"><h1 className="text-2xl font-bold mb-4">Sceller un fichier</h1><input type="text" placeholder="Titre" className="border p-2 w-full mb-4 text-black" value={title} onChange={(e) => setTitle(e.target.value)} /><input type="file" className="mb-4 block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button onClick={handleSeal} className="bg-green-600 text-white p-2 rounded w-full">Sceller</button><p className="mt-4 font-bold text-center text-black">{status}</p></main>);
}`,

  'stub-protocol.js': `const http = require('http');
const crypto = require('crypto');
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/seal') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ seal_id: crypto.randomUUID(), timestamp: new Date().toISOString(), anchor_tx: 'tx-' + crypto.randomBytes(4).toString('hex') }));
  } else { res.writeHead(404); res.end(); }
}).listen(8080, () => console.log('✅ Stub prêt sur 8080'));`,

  'next.config.ts': `import type { NextConfig } from "next";
const nextConfig: NextConfig = { transpilePackages: ['@noble/curves', '@noble/hashes'] };
export default nextConfig;`
};

for (const [filePath, content] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}
console.log('✅ Tous les fichiers ont été créés proprement !');
