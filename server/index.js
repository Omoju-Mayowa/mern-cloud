import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import upload from 'express-fileupload';
import helmet from 'helmet';
import { default as rateLimit } from 'express-rate-limit';

import { connectToAvailableMongoDB } from './utils/db.js';
import __dirname from './utils/directory.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

const app = express();

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));

// Allowed origins
const allowedOrigins = [
  process.env.SITE_LINK,
  'https://mern-cloud.vercel.app'
];

// Standard CORS setup for REST endpoints
app.use(cors({
  origin: (origin, callback) => {
    // allow server-to-server requests or tools with no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// Explicit headers for preflight (OPTIONS)
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true
}));

// File uploads
app.use(upload());
app.use(helmet({ crossOriginResourcePolicy: false }));

// Serve static uploads with CORS headers
app.use('/uploads', express.static(__dirname + '/../uploads', {
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(','));
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  }
}));

app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
app.set('trust proxy', 1);

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use('/api/users/', userRoutes);
app.use('/api/posts/', postRoutes);
app.use('/api/categories/', categoryRoutes);

// ─────────────────────────────────────────────
// SSE example route (replace or merge into postRoutes)
// ─────────────────────────────────────────────
app.get('/api/posts/stream', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ time: new Date() })}\n\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// ─────────────────────────────────────────────
// Error handlers
// ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────
// Database & Server
// ─────────────────────────────────────────────
try {
  await connectToAvailableMongoDB();
} catch (err) {
  console.error('❌ No MongoDB instance could be reached (offline or online both failed).');
  process.exit(1);
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
