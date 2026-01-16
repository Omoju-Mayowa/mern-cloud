import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import upload from 'express-fileupload';
import helmet from 'helmet';
import { default as rateLimit } from 'express-rate-limit';

import { connectToAvailableMongoDB } from './utils/db.js'
import __dirname from './utils/directory.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// ────────────────────────────────────────────────────────────
// ⚙️ Express setup
// ────────────────────────────────────────────────────────────

const app = express();

app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [process.env.SITE_LINK || 'https://mern-cloud.vercel.app/'];

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser or server-to-server requests with no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE']
}));

// Ensure Authorization header is allowed in CORS preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  next()
})

app.use(upload());
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use('/uploads', express.static(__dirname + '/../uploads', {
  setHeaders: (res, path) => {
    const origin = res.req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  }
}));

app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
app.set('trust proxy', 1);

app.use('/api/users/', userRoutes);
app.use('/api/posts/', postRoutes);
app.use('/api/categories/', categoryRoutes);

app.use(notFound);
app.use(errorHandler);

// Connect to an available MongoDB (tries cloud then local)
try {
  await connectToAvailableMongoDB()
} catch (err) {
  console.error('❌ No MongoDB instance could be reached (offline or online both failed).')
  process.exit(1)
}

const PORT = process.env.PORT || 5001
app.listen(PORT, () => console.log(`🚀Server Started on port ${PORT}`))
