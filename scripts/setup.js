// ==========================================================
// Runs automatically before "npm run dev" and "npm start".
// Creates .env if it is missing, prepares the folders and makes
// sure the database exists with the first administrator account.
// ==========================================================
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  let text = fs.readFileSync(examplePath, 'utf8');
  // Give every new installation its own signing secret.
  const secret = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  text = text.replace('JWT_SECRET=change-this-to-a-long-random-secret-string', `JWT_SECRET=${secret}`);
  fs.writeFileSync(envPath, text);
  console.log('Created .env from .env.example (with a fresh session secret).');
}

for (const folder of ['database', 'uploads', 'uploads/avatars', 'uploads/posts', 'uploads/clubs', 'uploads/homework', 'uploads/messages']) {
  fs.mkdirSync(path.join(root, folder), { recursive: true });
}

const { ensureDatabase } = await import('../server/db/seed.js');
await ensureDatabase();
