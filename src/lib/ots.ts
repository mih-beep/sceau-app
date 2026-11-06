const CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];

export type OtsResult = {
  ok: boolean;
  proof?: Buffer;
  calendars: string[];
  error?: string;
};

export async function submitToOts(hash: Uint8Array): Promise<OtsResult> {
  if (hash.length !== 32) {
    return { ok: false, calendars: [], error: 'hash_invalid_length' };
  }

  const successes: string[] = [];
  let proof: Buffer | undefined;

  for (const url of CALENDARS) {
    try {
      const res = await fetch(`${url}/digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(hash),
      });
      if (!res.ok) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      const magic = Buffer.from([0x00,0x4f,0x70,0x65,0x6e,0x54,0x69,0x6d,0x65,0x73,0x74,0x61,0x6d,0x70,0x73,0x00,0x00,0x50,0x72,0x6f,0x6f,0x66,0x00]);
      if (!buf.subarray(0, magic.length).equals(magic)) continue;

      successes.push(url);
      if (!proof) proof = buf;
    } catch {}
  }

  if (!proof) {
    return { ok: false, calendars: successes, error: 'all_calendars_failed' };
  }
  return { ok: true, proof, calendars: successes };
}

export async function upgradeOts(hash: Uint8Array): Promise<Buffer | null> {
  const hashHex = Buffer.from(hash).toString('hex');
  for (const url of CALENDARS) {
    try {
      const res = await fetch(`${url}/timestamp/${hashHex}`);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0) return buf;
    } catch {}
  }
  return null;
}
