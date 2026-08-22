import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config, isProduction } from './lib/config.js';
import { migrate, db } from './db/index.js';
import { attachUser } from './lib/auth.js';
import { HttpError } from './lib/util.js';
import { attachRealtime } from './realtime/index.js';

import { router as authRouter } from './routes/auth.js';
import { router as usersRouter } from './routes/users.js';
import { router as postsRouter } from './routes/posts.js';
import { router as messagesRouter } from './routes/messages.js';
import { router as clubsRouter } from './routes/clubs.js';
import { router as homeworkRouter } from './routes/homework.js';
import { router as announcementsRouter } from './routes/announcements.js';
import { router as notificationsRouter } from './routes/notifications.js';
import { router as gamesRouter } from './routes/games.js';
import { router as reportsRouter } from './routes/reports.js';
import { router as adminRouter } from './routes/admin.js';
import { router as dashboardRouter } from './routes/dashboard.js';

migrate();

const app = express();
app.set('trust proxy', 1);

// The whole app is self-hosted, so no external scripts or styles are allowed.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      // The hub is normally reached over plain http on a school network
      // (for example http://192.168.1.5:3000). Upgrading requests to https
      // would break every one of them, so it stays switched off.
      upgradeInsecureRequests: null
    }
  },
  // Allow classmates on the same network to load pictures and icons.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You are doing that a little too quickly. Please slow down.' }
}));

app.use(attachUser);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Grade 8 Hub', time: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/homework', homeworkRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

// ---------------------------------------------------------------------------
// Uploaded files - members only, so class pictures stay private.
// ---------------------------------------------------------------------------
app.use('/uploads', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to view this file.' });
  return next();
}, express.static(config.uploadDir, { maxAge: '7d', index: false, dotfiles: 'deny' }));

// ---------------------------------------------------------------------------
// The browser application
// ---------------------------------------------------------------------------
const clientDir = path.join(config.root, 'client');
const publicDir = path.join(config.root, 'public');
// The service worker controls every page, so it must be served from the
// root with no caching of its own - otherwise updates never reach anybody.
app.get('/sw.js', (_req, res) => {
  res.set('Service-Worker-Allowed', '/');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('application/javascript');
  res.sendFile(path.join(publicDir, 'sw.js'));
});

app.get('/manifest.webmanifest', (_req, res) => {
  res.type('application/manifest+json');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(publicDir, 'manifest.webmanifest'));
});

app.use(express.static(publicDir, { index: false }));
app.use(express.static(clientDir, { index: false, maxAge: isProduction ? '1h' : 0 }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(clientDir, 'index.html'));
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'That page or endpoint does not exist.' });
});

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `That file is larger than the ${config.maxUploadMb} MB limit.` });
  }
  if (status >= 500) console.error('[grade8-hub]', err);
  return res.status(status).json({
    error: status >= 500 && isProduction ? 'Something went wrong on the server.' : err.message,
    code: err.code || undefined
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const server = http.createServer(app);
attachRealtime(server);

/** The addresses other people on the same Wi-Fi or hotspot can use. */
export function networkAddresses(port = config.port) {
  const found = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        found.push(`http://${address.address}:${port}`);
      }
    }
  }
  return found;
}

server.listen(config.port, () => {
  const line = '='.repeat(58);
  const shared = networkAddresses();

  console.log(`\n${line}`);
  console.log('  GRADE 8 HUB is running');
  console.log(line);
  console.log(`  On this computer:      http://localhost:${config.port}`);

  if (shared.length) {
    console.log('');
    console.log('  Classmates on the same Wi-Fi or hotspot open:');
    for (const address of shared) console.log(`      ${address}`);
    console.log('');
    console.log('  No internet is needed - only the same network.');
    console.log('  Keep this window open while they are using the hub.');
  } else {
    console.log('  (No network connection found, so only this computer can use it.)');
  }

  console.log('');
  console.log(`  Database file:         ${path.relative(config.root, config.databaseFile)}`);
  console.log(`  Mode:                  ${config.env}`);
  console.log(`${line}\n  Press Ctrl + C to stop the server.\n`);
});

function shutdown(signal) {
  console.log(`\nStopping Grade 8 Hub (${signal})...`);
  server.close(() => {
    try { db.close(); } catch { /* already closed */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };
