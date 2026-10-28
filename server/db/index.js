import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../lib/config.js';
import { PERMISSIONS, ROLES, DEFAULT_SETTINGS, GAME_CATALOGUE, ACHIEVEMENTS } from '../lib/permissions.js';
import { SUBJECTS, TOPICS, QUESTIONS, EXTRA_QUESTIONS, TOPIC_ALIASES } from './practice-bank.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });

export const db = new Database(config.databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Adds a column to an existing table only if it is not already there. */
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Brings databases made by earlier versions up to date. */
function migrateExisting() {
  addColumnIfMissing('practice_questions', 'topic_id', 'INTEGER REFERENCES topics(id) ON DELETE SET NULL');
  addColumnIfMissing('practice_questions', 'kind', "TEXT NOT NULL DEFAULT 'multiple_choice'");
  addColumnIfMissing('practice_questions', 'code_snippet', "TEXT DEFAULT ''");
  addColumnIfMissing('practice_questions', 'accepted_json', "TEXT DEFAULT ''");
}

/** Create every table (idempotent) and load the reference data. */
export function migrate() {
  const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrateExisting();
  loadReferenceData();
}

function loadReferenceData() {
  const insertPerm = db.prepare('INSERT INTO permissions (key, description) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET description = excluded.description');
  const insertRole = db.prepare('INSERT INTO roles (key, name, rank, description) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET name = excluded.name, rank = excluded.rank, description = excluded.description');
  const clearRolePerms = db.prepare('DELETE FROM role_permissions WHERE role_key = ?');
  const insertRolePerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)');
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const insertGame = db.prepare(`
    INSERT INTO games (key, name, description, icon, category, enabled, multiplayer, score_label, score_order)
    VALUES (@key, @name, @description, @icon, @category, 1, @multiplayer, @score_label, @score_order)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name, description = excluded.description, icon = excluded.icon,
      category = excluded.category, multiplayer = excluded.multiplayer,
      score_label = excluded.score_label, score_order = excluded.score_order`);
  const insertAchievement = db.prepare('INSERT INTO achievements (key, name, description, icon) VALUES (@key, @name, @description, @icon) ON CONFLICT(key) DO UPDATE SET name = excluded.name, description = excluded.description, icon = excluded.icon');

  db.transaction(() => {
    for (const [key, description] of Object.entries(PERMISSIONS)) insertPerm.run(key, description);
    for (const role of ROLES) {
      insertRole.run(role.key, role.name, role.rank, role.description);
      clearRolePerms.run(role.key);
      for (const p of role.permissions) insertRolePerm.run(role.key, p);
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(key, value);
    for (const g of GAME_CATALOGUE) insertGame.run(g);
    for (const a of ACHIEVEMENTS) insertAchievement.run(a);
    loadPracticeBank();
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

export function logActivity(actorId, action, targetType = '', targetId = '', details = '') {
  run(
    'INSERT INTO activity_logs (actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
    actorId ?? null, action, targetType, String(targetId ?? ''), details
  );
}

/**
 * Puts the starter subjects and questions in place.
 * Questions are matched on their wording, so running this again never
 * duplicates them, and anything a teacher adds is left alone.
 */
function loadPracticeBank() {
  const insertSubject = db.prepare(
    'INSERT INTO subjects (name, icon, description, sort_order) VALUES (@name, @icon, @description, @sort_order) ON CONFLICT(name) DO NOTHING'
  );
  for (const subject of SUBJECTS) insertSubject.run(subject);

  const subjectId = db.prepare('SELECT id FROM subjects WHERE name = ?');

  // Topics belong to a subject, so they are added once that exists.
  const insertTopic = db.prepare(
    'INSERT INTO topics (subject_id, name, description, sort_order) VALUES (?, ?, ?, ?) ON CONFLICT(subject_id, name) DO NOTHING'
  );
  TOPICS.forEach(([subjectName, name, description], index) => {
    const subject = subjectId.get(subjectName);
    if (subject) insertTopic.run(subject.id, name, description, index);
  });

  const topicId = db.prepare('SELECT id FROM topics WHERE subject_id = ? AND name = ?');
  // Two different code questions can legitimately share a prompt such as
  // "What does this print?", so the code they show is part of their identity.
  const exists = db.prepare(
    "SELECT 1 AS x FROM practice_questions WHERE question = ? AND COALESCE(code_snippet, '') = ?"
  );
  const insertQuestion = db.prepare(`
    INSERT INTO practice_questions
      (subject_id, topic_id, topic, kind, difficulty, question, options_json, answer_index,
       accepted_json, code_snippet, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const addAll = (items) => {
    for (const item of items) {
      const subject = subjectId.get(item.subject);
      if (!subject) continue;
      if (exists.get(item.question, item.codeSnippet || '')) continue;
      const topicName = TOPIC_ALIASES[item.subject]?.[item.topic] || item.topic;
      const topic = topicName ? topicId.get(subject.id, topicName) : null;
      insertQuestion.run(
        subject.id,
        topic ? topic.id : null,
        topicName || '',
        item.kind || 'multiple_choice',
        item.difficulty,
        item.question,
        JSON.stringify(item.options || []),
        item.answer_index ?? 0,
        item.accepted ? JSON.stringify(item.accepted) : '',
        item.codeSnippet || '',
        item.explanation
      );
    }
  };

  addAll(QUESTIONS);
  addAll(EXTRA_QUESTIONS);
}
