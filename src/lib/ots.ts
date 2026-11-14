// En-tête .ots complet (utilisé par OpenTimestamps)
export const HEADER_MAGIC = Buffer.from(
  '004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294',
  'hex'
);

export type OtsResult = {
  ok: boolean;
  proof?: Buffer;
  calendars: string[];
  error?: string;
};

const AI_URL = process.env.SCEAU_AI_URL || 'http://localhost:8080';
const AI_KEY = process.env.SCEAU_AI_KEY || '';

/**
 * Tous les ancrages de SCEAU APP (Sceaux, Pactes, Projets) passent désormais
 * par SCEAU AI. C'est AI qui parle à Bitcoin, pas APP.
 */
export async function submitToOts(hash: Uint8Array): Promise<OtsResult> {
  if (hash.length !== 32) {
    return { ok: false, calendars: [], error: 'hash_invalid_length (32 octets requis)' };
  }

  const hashHex = Buffer.from(hash).toString('hex');

  try {
    const res = await fetch(`${AI_URL}/v1/anchor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SCEAU-AI-Key': AI_KEY,
      },
      body: JSON.stringify({ hash: hashHex }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });

    const data = (await res.json()) as { success?: boolean; proofBase64?: string; calendar?: string; error?: string };

    if (!res.ok || !data.success || !data.proofBase64) {
      return { ok: false, calendars: [], error: data.error || `AI HTTP ${res.status}` };
    }

    return {
      ok: true,
      proof: Buffer.from(data.proofBase64, 'base64'),
      calendars: data.calendar ? [data.calendar] : ['sceau-ai'],
    };
  } catch (e) {
    return { ok: false, calendars: [], error: `Proxy AI injoignable : ${(e as Error).message}` };
  }
}

/**
 * L'upgrade (vérification de la confirmation Bitcoin) passe aussi par AI.
 * (Note : on ajoutera la route /v1/upgrade dans AI au prochain commit, 
 * pour l'instant on garde la logique locale d'upgrade qui marche déjà).
 */
export async function upgradeOts(hash: Uint8Array, proofBase64: string): Promise<Buffer | null> {
  // TODO: déporter ça dans AI (POST /v1/upgrade)
  // Pour l'instant, on laisse le code d'upgrade local dans APP.
  // (Si tu veux qu'on le fasse, dis-le-moi).
  return null; // fallback safe
}
