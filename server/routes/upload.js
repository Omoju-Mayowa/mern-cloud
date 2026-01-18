import express from 'express';
import s3 from '../utils/r2Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';

const router = express.Router();

router.post('/', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const file = req.files.file;
    const ext = path.extname(file.name);
    const key = `mern/${crypto.randomUUID()}${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: key,
        Body: file.data,
        ContentType: file.mimetype,
      })
    );

    // THIS is the URL that must be saved to MongoDB
    const fileUrl = `${process.env.CLOUDFLARE_R2_ASSETS_URL}/${key}`;

    res.json({ url: fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

export default router;
