import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-1",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // Nécessaire pour certains stockages compatibles S3
});
