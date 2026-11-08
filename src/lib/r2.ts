import { S3Client } from '@aws-sdk/client-s3';
import { requireS3 } from '@/lib/env';

let _client: S3Client | null = null;

function create(): S3Client {
  const { endpoint, region } = requireS3();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Clés S3 manquantes : AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY');
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export function getR2Client(): S3Client {
  if (!_client) _client = create();
  return _client;
}

export const r2Client = new Proxy({} as S3Client, {
  get(_t, prop) {
    const real = getR2Client() as any;
    const v = real[prop];
    return typeof v === 'function' ? v.bind(real) : v;
  },
});
