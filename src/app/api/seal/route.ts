import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
const OpenTimestamps = require('javascript-opentimestamps');

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

    let otsProofPath = null;
    let timestamp = new Date().toISOString();
    
    try {
      const hashBuffer = Buffer.from(hash, 'base64');
      const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
        new OpenTimestamps.Ops.OpSHA256(), 
        hashBuffer
      );
      await OpenTimestamps.stamp(detached);
      
      const otsFilename = hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) + '.ots';
      const otsDir = join(process.cwd(), 'public/ots');
      await mkdir(otsDir, { recursive: true });
      
      const otsBuffer = detached.serialize();
      await writeFile(join(otsDir, otsFilename), otsBuffer);
      otsProofPath = '/ots/' + otsFilename;
      
      console.log(`✅ Preuve OpenTimestamps générée : ${otsProofPath}`);
    } catch (otsError) {
      console.error("⚠️ Erreur OpenTimestamps :", otsError);
    }

    await pool.query(
      `INSERT INTO seals (hash, timestamp, author_id, title, description, category, is_public, is_hosted, file_path) 
       VALUES (decode($1, 'base64'), $2, $3, $4, $5, $6, $7, $8, $9)`,
      [hash, timestamp, authorId, title, description, category, isPublic, isHosted, filePath]
    );

    return NextResponse.json({
      seal_id: Math.random().toString(36).substring(2, 10), // ID simple sans bug
      timestamp: timestamp,
      ots_proof: otsProofPath
    });
  } catch (error) { 
    console.error(error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 }); 
  }
}
