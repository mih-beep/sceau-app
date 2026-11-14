// En-tête .ots complet (31 octets) :
// \x00 + "OpenTimestamps" (14) + \x00\x00 + "Proof" (5) + \x00 + 8 octets magiques
const HEADER_MAGIC = Buffer.from(
  '004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294',
  'hex'
);

const CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];

const CALENDAR_TIMEOUT_MS = 8_000;
const MAX_PROOF_BYTES = 64 * 1024;

export type OtsResult = {
  ok: boolean;
  proof?: Buffer;
  calendars: string[];
  error?: string;
};

function toDetachedOts(hash: Uint8Array, calendarBody: Buffer): Buffer {
  if (calendarBody.length >= HEADER_MAGIC.length &&
      calendarBody.subarray(0, HEADER_MAGIC.length).equals(HEADER_MAGIC)) {
    return calendarBody;
  }
  // Si le calendar a renvoyé une preuve partielle sans header, on l'encapsule proprement
  const hashBuffer = Buffer.from(hash);
  return Buffer.concat([
    HEADER_MAGIC,
    Buffer.from([0x01, 0x08]), // version 1 + op SHA-256
    hashBuffer,
    calendarBody,
  ]);
}

async function submitOne(url: string, hash: Uint8Array): Promise<Buffer> {
  const res = await fetch(`${url}/digest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      Accept: 'application/vnd.opentimestamps.v1',
      'User-Agent': 'sceau/1.0',
    },
    body: Buffer.from(hash),
    signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_PROOF_BYTES) throw new Error('taille invalide');
  if (buf[0] === 0x3c || buf[0] === 0x7b) throw new Error('réponse non binaire (HTML/JSON)');
  return buf;
}

export async function submitToOts(hash: Uint8Array): Promise<OtsResult> {
  if (hash.length !== 32) return { ok: false, calendars: [], error: 'hash_invalid_length' };

  const settled = await Promise.allSettled(CALENDARS.map((u) => submitOne(u, hash)));

  const successes: string[] = [];
  let body: Buffer | undefined;
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      successes.push(CALENDARS[i]);
      if (!body) body = r.value;
    }
  });

  if (!body) return { ok: false, calendars: successes, error: 'all_calendars_failed' };
  return { ok: true, proof: toDetachedOts(hash, body), calendars: successes };
}

// Upgrade : interroge les calendars avec le hash de l'ENGAGEMENT contenu dans la preuve
// (pas le hash du fichier — sinon ça ne confirme jamais).
export async function upgradeOts(hash: Uint8Array, proofBase64: string): Promise<Buffer | null> {
  let engagement: Uint8Array = hash;
  try {
    const raw = Buffer.from(proofBase64, 'base64');
    if (raw.length > HEADER_MAGIC.length + 34 &&
        raw.subarray(0, HEADER_MAGIC.length).equals(HEADER_MAGIC)) {
      const version = raw[HEADER_MAGIC.length];
      const op = raw[HEADER_MAGIC.length + 1];
      if (version === 0x01 && op === 0x08) {
        engagement = raw.subarray(HEADER_MAGIC.length + 2, HEADER_MAGIC.length + 34);
      }
    }
  } catch { /* fallback hash */ }

  const hashHex = Buffer.from(engagement).toString('hex');
  const settled = await Promise.allSettled(
    CALENDARS.map(async (url) => {
      const res = await fetch(`${url}/timestamp/${hashHex}`, {
        signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_PROOF_BYTES) throw new Error('taille invalide');
      return buf;
    })
  );

  let best: Buffer | null = null;
  for (const r of settled) {
    if (r.status === 'fulfilled' && (!best || r.value.length > best.length)) best = r.value;
  }
  return best;
}
