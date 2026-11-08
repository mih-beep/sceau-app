export function safeKeyPart(input: string, maxLen = 80): string {
  if (!input) return 'file';
  const ascii = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = ascii.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const safe = cleaned.replace(/^\.+/, '').replace(/\.{2,}/g, '.').replace(/-+/g, '-');
  return (safe || 'file').slice(0, maxLen);
}

export function buildS3Key(opts: {
  authorId: string; hashBase64: string; originalName: string; prefix?: string;
}): string {
  const prefix = opts.prefix || 'seal';
  const authorShort = opts.authorId.replace(/-/g, '').slice(0, 8);
  const hashShort = opts.hashBase64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  const safeName = safeKeyPart(opts.originalName, 80);
  return `${prefix}/${authorShort}/${hashShort}-${safeName}`;
}

export function extractS3Key(filePath: string): string | null {
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || '').replace(/\/$/, '');
  const bucket = (process.env.S3_BUCKET || '').replace(/^\/+|\/+$/g, '');
  const prefix = `${endpoint}/${bucket}/`;
  if (filePath.startsWith(prefix)) return filePath.slice(prefix.length);
  return filePath.split('/').pop() || null;
}
