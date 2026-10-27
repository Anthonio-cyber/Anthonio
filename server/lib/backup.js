// ==========================================================
// Keeping the class data safe on free hosting.
//
// Free hosting has no permanent disk: the moment the server sleeps
// or redeploys, the database is wiped. This saves a copy of the
// database and the uploaded pictures into a private GitHub
// repository, and puts it back when the server starts again.
//
// It costs nothing and needs no card. Set these to switch it on:
//   BACKUP_REPO   e.g. Anthonio-cyber/grade8-backup
//   BACKUP_TOKEN  a GitHub token that can write to that repository
// ==========================================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { config } from './config.js';

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const REPO = process.env.BACKUP_REPO || '';
const TOKEN = process.env.BACKUP_TOKEN || '';
const FILE_PATH = process.env.BACKUP_PATH || 'backups/grade8hub-backup.tar.gz';
const BRANCH = process.env.BACKUP_BRANCH || 'main';
const EVERY_MINUTES = Number(process.env.BACKUP_INTERVAL_MINUTES || 10);

/** Backups only run when a repository and token have been provided. */
export const backupEnabled = () => Boolean(REPO && TOKEN);

const headers = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'grade8-hub-backup',
  'X-GitHub-Api-Version': '2022-11-28'
});

const contentsUrl = () => `${API}/repos/${REPO}/contents/${FILE_PATH}`;

/** The id of the copy already stored, needed to replace it. */
async function existingSha() {
  try {
    const response = await fetch(`${contentsUrl()}?ref=${encodeURIComponent(BRANCH)}`, { headers: headers() });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const body = await response.json();
    return body.sha || null;
  } catch {
    return null;
  }
}

function tarAvailable() {
  try {
    execFileSync('tar', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Recent writes live in SQLite's write-ahead log, not in the database
 * file itself, so backing up the file alone can quietly miss the newest
 * messages. Fold the log into the database before copying it.
 */
async function flushRecentWrites() {
  try {
    const { default: Database } = await import('better-sqlite3');
    const handle = new Database(config.databaseFile);
    handle.pragma('wal_checkpoint(TRUNCATE)');
    handle.close();
  } catch (err) {
    // Not fatal: the log files are copied too, just below.
    console.warn('[backup] Could not fold in the latest writes:', err.message);
  }
}

/** Packs the database and uploads into one file. */
function packEverything() {
  const archive = path.join(os.tmpdir(), `grade8hub-backup-${Date.now()}.tar.gz`);
  const dbDir = path.dirname(config.databaseFile);
  const dbName = path.basename(config.databaseFile);

  const args = ['-czf', archive, '-C', dbDir, dbName];

  // Copy the log files too, so nothing written in the last moments is lost.
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(config.databaseFile + suffix)) args.push(dbName + suffix);
  }

  if (fs.existsSync(config.uploadDir)) {
    args.push('-C', path.dirname(config.uploadDir), path.basename(config.uploadDir));
  }
  execFileSync('tar', args, { stdio: 'ignore' });
  return archive;
}

/**
 * Saves the current data. Called every so often, and once more when
 * the host shuts the server down, so going to sleep loses nothing.
 */
export async function saveBackup(reason = 'scheduled') {
  if (!backupEnabled()) return { skipped: 'not configured' };
  if (!fs.existsSync(config.databaseFile)) return { skipped: 'no database yet' };
  if (!tarAvailable()) return { skipped: 'tar is not available on this system' };

  let archive;
  try {
    await flushRecentWrites();
    archive = packEverything();
    const bytes = fs.statSync(archive).size;

    // GitHub will not take very large files, and base64 makes them bigger.
    const limit = 25 * 1024 * 1024;
    if (bytes > limit) {
      console.warn(`[backup] Skipped: the data is ${(bytes / 1048576).toFixed(1)} MB, which is too big to store this way.`);
      console.warn('[backup] Delete some uploaded pictures, or move to hosting with a real disk.');
      return { skipped: 'too large', bytes };
    }

    const body = {
      message: `Grade 8 Hub backup (${reason}) ${new Date().toISOString()}`,
      content: fs.readFileSync(archive).toString('base64'),
      branch: BRANCH
    };
    const sha = await existingSha();
    if (sha) body.sha = sha;

    const response = await fetch(contentsUrl(), {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[backup] Could not save (${response.status}): ${text.slice(0, 200)}`);
      return { ok: false, status: response.status };
    }

    console.log(`[backup] Saved ${(bytes / 1024).toFixed(0)} KB (${reason}).`);
    return { ok: true, bytes };
  } catch (err) {
    console.warn('[backup] Could not save:', err.message);
    return { ok: false, error: err.message };
  } finally {
    if (archive) { try { fs.rmSync(archive); } catch { /* already gone */ } }
  }
}

/**
 * Puts the data back when the server starts with nothing on disk.
 * Must run BEFORE anything opens the database.
 */
export async function restoreIfNeeded() {
  if (!backupEnabled()) return { skipped: 'not configured' };
  if (fs.existsSync(config.databaseFile)) return { skipped: 'database already here' };
  if (!tarAvailable()) return { skipped: 'tar is not available on this system' };

  console.log('[backup] No database found. Looking for a saved copy...');
  let archive;
  try {
    const response = await fetch(`${contentsUrl()}?ref=${encodeURIComponent(BRANCH)}`, {
      headers: { ...headers(), Accept: 'application/vnd.github.raw' }
    });

    if (response.status === 404) {
      console.log('[backup] Nothing saved yet - starting fresh.');
      return { skipped: 'no backup yet' };
    }
    if (!response.ok) {
      console.warn(`[backup] Could not fetch the saved copy (${response.status}). Starting fresh.`);
      return { ok: false, status: response.status };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    archive = path.join(os.tmpdir(), `grade8hub-restore-${Date.now()}.tar.gz`);
    fs.writeFileSync(archive, buffer);

    fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
    // The archive holds the database next to the uploads folder.
    execFileSync('tar', ['-xzf', archive, '-C', path.dirname(config.databaseFile)], { stdio: 'ignore' });

    // Uploads were packed relative to their own parent, so move them if needed.
    const extractedUploads = path.join(path.dirname(config.databaseFile), path.basename(config.uploadDir));
    if (fs.existsSync(extractedUploads) && path.resolve(extractedUploads) !== path.resolve(config.uploadDir)) {
      fs.mkdirSync(path.dirname(config.uploadDir), { recursive: true });
      fs.cpSync(extractedUploads, config.uploadDir, { recursive: true });
      fs.rmSync(extractedUploads, { recursive: true, force: true });
    }

    console.log('[backup] Restored the class data from the saved copy.');
    return { ok: true };
  } catch (err) {
    console.warn('[backup] Could not restore:', err.message);
    return { ok: false, error: err.message };
  } finally {
    if (archive) { try { fs.rmSync(archive); } catch { /* already gone */ } }
  }
}

let timer = null;

/** Saves regularly while the server is running. */
export function startBackupSchedule() {
  if (!backupEnabled() || timer) return;
  const minutes = Math.max(2, EVERY_MINUTES);
  timer = setInterval(() => { saveBackup('scheduled'); }, minutes * 60 * 1000);
  timer.unref?.();
  console.log(`[backup] Saving the class data to ${REPO} every ${minutes} minutes.`);
}

export function stopBackupSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
}
