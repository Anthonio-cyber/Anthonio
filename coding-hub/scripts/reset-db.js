// Deletes the database file and rebuilds it from scratch.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import readline from 'node:readline/promises';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const { config } = await import('../server/lib/config.js');
const file = config.databaseFile;

if (!fs.existsSync(file)) {
  console.log('There is no database file yet - nothing to reset.');
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`This deletes EVERYTHING in ${path.relative(root, file)}.\nType "yes" to continue: `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Cancelled. Nothing was deleted.');
    process.exit(0);
  }
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const target = file + suffix;
    if (fs.existsSync(target)) fs.rmSync(target);
  }
  console.log('Database deleted.');
}

const { ensureDatabase } = await import('../server/db/seed.js');
await ensureDatabase();
console.log('A fresh database is ready.');
process.exit(0);
