// ==========================================================
// Starts the hub with its database ready.
// Used by the desktop app, which has no npm scripts to lean on.
// ==========================================================
import { ensureDatabase } from './db/seed.js';

await ensureDatabase();
await import('./index.js');
