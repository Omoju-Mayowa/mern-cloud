// backend/routes/upload.js
import express from 'express';
import s3 from '../utils/r2Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';

const router = express.Router();

// POST /api/upload
router.post('/', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const file = req.files.file;

    // Generate a unique filename
    const ext = path.extname(file.name);
    const key = `mern/${crypto.randomUUID()}${ext}`; // organize files under /mern

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET, // your bucket name
      Key: key,
      Body: file.data,
      ContentType: file.mimetype,
      ACL: 'public-read', // optional, allows public access
    });

    await s3.send(command);

    // Public URL for frontend should use CLOUDFLARE_R2_ASSETS_URL
    // Example: https://<your-bucket>.r2.cloudflarestorage.com/mern/<file>
    const fileUrl = `${process.env.CLOUDFLARE_R2_ASSETS_URL}/${key}`;

    res.status(200).json({ url: fileUrl });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ message: 'File upload failed.', error: err.message });
  }
});

export default router;
