// backend/utils/r2Client.js
import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // e.g., "https://<account_id>.r2.cloudflarestorage.com"
  region: "auto", // R2 doesn’t require a real AWS region
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY,
  },
});

export default s3;
