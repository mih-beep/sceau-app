// Validation centralisée des variables d'environnement.
// Échoue TÔT avec un message clair au lieu de produire `undefined/undefined/clé`.

function clean(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return v.trim().replace(/^['"]|['"]$/g, '');
}

function required(name: string): string {
  const v = clean(process.env[name]);
  if (!v) throw new Error(`Variable d'environnement manquante ou vide : ${name}`);
  return v;
}

function optional(name: string, def = ''): string {
  return clean(process.env[name]) ?? def;
}

export function requireS3(): { endpoint: string; bucket: string; region: string } {
  const endpoint = required('AWS_ENDPOINT_URL_S3').replace(/\/$/, '');
  const bucket = required('S3_BUCKET').replace(/^\/+|\/+$/g, '');
  const region = optional('AWS_REGION', 'us-west-004');
  return { endpoint, bucket, region };
}

export function requireDb(): string {
  return required('DATABASE_URL');
}
