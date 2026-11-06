import { S3Client } from "@aws-sdk/client-s3";

// Le .trim() enlève les espaces invisibles qui causent l'erreur "Invalid character"
export const r2Client = new S3Client({
  region: process.env.AWS_REGION?.trim() || "ap-southeast-1",
  endpoint: process.env.AWS_ENDPOINT_URL_S3?.trim(),
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || "").trim(),
  },
  forcePathStyle: true,
});
