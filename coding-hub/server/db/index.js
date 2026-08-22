import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../lib/config.js';
import { PERMISSIONS, ROLES, DEFAULT_SETTINGS, BADGES } from '../lib/permissions.js';
import { seedCurriculum } from './seed-curriculum.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });

export const db = new Database(config.databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Create every table (idempotent) and load the reference data. */
export function migrate() {
  const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  db.exec(schema);
  loadReferenceData();
  seedCurriculum(db);
}

function loadReferenceData() {
  const insertPerm = db.prepare('INSERT INTO permissions (key, description) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET description = excluded.description');
  const insertRole = db.prepare('INSERT INTO roles (key, name, rank, description) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET name = excluded.name, rank = excluded.rank, description = excluded.description');
  const clearRolePerms = db.prepare('DELETE FROM role_permissions WHERE role_key = ?');
  const insertRolePerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)');
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  // Only the built-in badges are refreshed; badges an admin wrote are left alone.
  const insertBadge = db.prepare(`
    INSERT INTO badges (key, name, description, icon, is_custom) VALUES (@key, @name, @description, @icon, 0)
    ON CONFLICT(key) DO UPDATE SET name = excluded.name, description = excluded.description, icon = excluded.icon
    WHERE badges.is_custom = 0`);

  db.transaction(() => {
    for (const [key, description] of Object.entries(PERMISSIONS)) insertPerm.run(key, description);
    for (const role of ROLES) {
      insertRole.run(role.key, role.name, role.rank, role.description);
      clearRolePerms.run(role.key);
      for (const p of role.permissions) insertRolePerm.run(role.key, p);
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(key, value);
    for (const badge of BADGES) insertBadge.run(badge);
  })();
}

// ---------- small helpers used across the routes ----------
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export function getSetting(key, fallback = '') {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
}

export function allSettings() {
  return Object.fromEntries(all('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
}

/** Records an administrative action. Section 47 of the specification. */
export function logActivity(actorId, action, targetType = '', targetId = '', details = '') {
  run(
    'INSERT INTO activity_logs (actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
    actorId ?? null, action, targetType, String(targetId ?? ''), details
  );
}
