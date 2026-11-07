import { NextResponse } from 'next/server';
import { hashDocument, anchorToBitcoin } from '../../../../../../sceau-protocol/src/index';

// Système anti-spam basique (en mémoire, se reset au redémarrage du serveur)
const ipCache = new Map<string, { count: number, lastReset: number }>();
const LIMIT = 10; // 10 requêtes max
const WINDOW = 60 * 1000; // par minute

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
    const now = Date.now();
    
    // Rate Limiting
    const clientData = ipCache.get(ip) || { count: 0, lastReset: now };
    if (now - clientData.lastReset > WINDOW) {
      clientData.count = 0;
      clientData.lastReset = now;
    }
    if (clientData.count >= LIMIT) {
      return NextResponse.json({ error: 'Trop de requêtes. Attendez 1 minute (Rate Limit).' }, { status: 429 });
    }
    clientData.count++;
    ipCache.set(ip, clientData);

    // Traitement
    const data = await req.formData();
    const file = data.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const hashHex = hashDocument(new Uint8Array(buffer));
    const { otsProof, calendars } = await anchorToBitcoin(hashHex);

    return NextResponse.json({
      success: true,
      document: { name: file.name, hash_sha256: hashHex },
      bitcoin_anchor: { secured: otsProof !== null, ots_proof_base64: otsProof, calendars_used: calendars }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
