import { sha256 } from '@noble/hashes/sha256';

const CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];

/**
 * Calcule l'empreinte SHA-256 d'un fichier (Buffer ou Uint8Array).
 */
export function hashDocument(content: Uint8Array): string {
  const hash = sha256(content);
  return Buffer.from(hash).toString('hex');
}

/**
 * Ancre un hash sur la blockchain Bitcoin via OpenTimestamps.
 * Retourne la preuve .ots en base64, prête à être stockée.
 */
export async function anchorToBitcoin(hashHex: string): Promise<{ otsProof: string | null, calendars: string[] }> {
  const hashBytes = Buffer.from(hashHex, 'hex');
  const successes: string[] = [];
  let proof: Buffer | undefined;

  for (const url of CALENDARS) {
    try {
      const res = await fetch(`${url}/digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: hashBytes,
      });
      if (!res.ok) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      const magic = Buffer.from([0x00,0x4f,0x70,0x65,0x6e,0x54,0x69,0x6d,0x65,0x73,0x74,0x61,0x6d,0x70,0x73,0x00,0x00,0x50,0x72,0x6f,0x6f,0x66,0x00]);
      
      if (!buf.subarray(0, magic.length).equals(magic)) continue;

      successes.push(url);
      if (!proof) proof = buf;
    } catch (e) {
      // Calendar indisponible, on tente le suivant
    }
  }

  return {
    otsProof: proof ? proof.toString('base64') : null,
    calendars: successes
  };
}
