import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(url.fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');

// Load .env if the user made one; otherwise fall back to .env.example values
// so that a fresh clone still starts without any manual configuration.
const envFile = path.join(ROOT, '.env');
dotenv.config({ path: fs.existsSync(envFile) ? envFile : path.join(ROOT, '.env.example') });

const bool = (v, fallback = false) => {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

export const config = {
  root: ROOT,
  port: Number(process.env.PORT || 3000),
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'grade8-hub-development-secret',
  sessionDays: Number(process.env.SESSION_DAYS || 14),
  databaseFile: path.resolve(ROOT, process.env.DATABASE_FILE || './database/grade8hub.db'),
  uploadDir: path.resolve(ROOT, process.env.UPLOAD_DIR || './uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 8),
  seedDemoData: bool(process.env.SEED_DEMO_DATA, true),
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'Grade8Admin!',
    displayName: process.env.ADMIN_DISPLAY_NAME || 'Head Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@grade8hub.local'
  }
};

export const isProduction = config.env === 'production';
