import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(url.fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');

// Load .env if there is one; otherwise fall back to .env.example so a
// fresh clone still starts without any manual configuration.
const envFile = path.join(ROOT, '.env');
dotenv.config({ path: fs.existsSync(envFile) ? envFile : path.join(ROOT, '.env.example') });

const bool = (v, fallback = false) => {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

export const config = {
  root: ROOT,
  port: Number(process.env.PORT || 4000),
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'coding-hub-development-secret',
  sessionDays: Number(process.env.SESSION_DAYS || 14),
  databaseFile: path.resolve(ROOT, process.env.DATABASE_FILE || './database/codinghub.db'),
  uploadDir: path.resolve(ROOT, process.env.UPLOAD_DIR || './uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 8),
  seedDemoData: bool(process.env.SEED_DEMO_DATA, false),
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'CodingHub!2026',
    displayName: process.env.ADMIN_DISPLAY_NAME || 'Site Owner',
    email: process.env.ADMIN_EMAIL || 'admin@codinghub.local'
  }
};

export const isProduction = config.env === 'production';
