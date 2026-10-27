// ==========================================================
// Starts the hub with its database ready.
// Used by the desktop app, which has no npm scripts to lean on.
// ==========================================================
// Put any saved copy back before the database is opened.
const { restoreIfNeeded } = await import('./lib/backup.js');
await restoreIfNeeded();

const { ensureDatabase } = await import('./db/seed.js');
await ensureDatabase();
await import('./index.js');
