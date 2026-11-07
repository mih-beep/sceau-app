import { NextResponse } from 'next/server';
import { hashDocument, anchorToBitcoin } from '../../../../../../sceau-protocol/src/index';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const file = data.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni. Utilisez le champ "file".' }, { status: 400 });
    }

    // 1. Calculer le hash SHA-256
    const buffer = Buffer.from(await file.arrayBuffer());
    const hashHex = hashDocument(new Uint8Array(buffer));

    // 2. Ancrer sur Bitcoin
    const { otsProof, calendars } = await anchorToBitcoin(hashHex);

    // 3. Renvoyer la preuve au développeur (sans passer par notre base de données)
    return NextResponse.json({
      success: true,
      protocol: "SCEAU v1.0",
      document: {
        name: file.name,
        size: file.size,
        hash_sha256: hashHex,
      },
      bitcoin_anchor: {
        secured: otsProof !== null,
        ots_proof_base64: otsProof,
        calendars_used: calendars
      },
      verification_url: `https://opentimestamps.org/` // Le dev pourra vérifier le .ots ici
    });

  } catch (error: any) {
    console.error('[Open API Error]', error);
    return NextResponse.json({ error: 'Erreur lors du scellement.' }, { status: 500 });
  }
}
