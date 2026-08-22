// ==========================================================
// Coding Hub - the administrator's content tools.
//
// Subjects, topics, lessons (with versions), coding challenges and
// the question bank, plus bulk editing, import/export and analytics.
//
// Every route names the permission it needs. Nothing here trusts the
// browser: a member without the permission is refused server-side even
// if they somehow reach the endpoint.
//
// No content on this platform is generated. Everything below is a tool
// for a human administrator to write and organise their own material.
// ==========================================================
import express from 'express';
import { db, get, all, run, logActivity } from '../db/index.js';
import { requireAuth, requirePermission, can } from '../lib/auth.js';
import { HttpError, wrap, clean, parsePage, slugify } from '../lib/util.js';
import { userById } from '../lib/serialize.js';
import {
  serializeSubject, serializeTopic, serializeLesson, serializeChallenge, serializeQuestion,
  parseBlocks, QUESTION_TYPES, DIFFICULTIES
} from '../lib/learn.js';

export const router = express.Router();
router.use(requireAuth, requirePermission('admin.access'));

const ICONS = ['code', 'zap', 'brain', 'image', 'grid', 'flag', 'book', 'target', 'star', 'keyboard'];
const COLOURS = ['violet', 'blue', 'green', 'amber', 'orange', 'red', 'cyan', 'pink'];

const bodyText = (value, max) => clean(String(value ?? ''), max);

/** Lesson blocks are stored as JSON. Only known block shapes are kept. */
const BLOCK_TYPES = new Set([
  'heading', 'paragraph', 'code', 'list', 'note', 'warning', 'info',
  'table', 'image', 'video', 'link', 'example'
]);

function sanitiseBlocks(input) {
  const blocks = Array.isArray(input) ? input : [];
  const out = [];
  for (const raw of blocks.slice(0, 200)) {
    if (!raw || typeof raw !== 'object') continue;
    const type = String(raw.type || '');
    if (!BLOCK_TYPES.has(type)) continue;

    const block = { type };
    if (raw.title !== undefined) block.title = clean(raw.title, 200);
    if (raw.text !== undefined) block.text = clean(raw.text, 8000);
    if (raw.code !== undefined) block.code = String(raw.code ?? '').slice(0, 20000);
    if (raw.language !== undefined) block.language = clean(raw.language, 20);
    if (raw.url !== undefined) block.url = clean(raw.url, 500);
    if (raw.ordered !== undefined) block.ordered = !!raw.ordered;
    if (Array.isArray(raw.items)) block.items = raw.items.slice(0, 60).map((i) => clean(i, 1000));
    if (Array.isArray(raw.headers)) block.headers = raw.headers.slice(0, 12).map((h) => clean(h, 200));
    if (Array.isArray(raw.rows)) {
      block.rows = raw.rows.slice(0, 60).map((row) =>
        (Array.isArray(row) ? row : []).slice(0, 12).map((cell) => clean(cell, 600)));
    }
    out.push(block);
  }
  return out;
}

const linesToText = (value, max = 30) => {
  if (Array.isArray(value)) return value.slice(0, max).map((v) => clean(v, 500)).join('\n');
  return String(value ?? '').split('\n').slice(0, max).map((v) => clean(v, 500)).filter(Boolean).join('\n');
};

// ===========================================================================
// Subjects
// ===========================================================================
router.get('/subjects', requirePermission('subjects.view'), wrap(async (req, res) => {
  const rows = all('SELECT * FROM subjects ORDER BY position, id');
  res.json({
    subjects: rows.map((s) => serializeSubject(s, req.user.id)),
    icons: ICONS,
    colours: COLOURS
  });
}));

router.post('/subjects', requirePermission('subjects.create'), wrap(async (req, res) => {
  const name = clean(req.body.name, 60);
  if (!name) throw new HttpError(400, 'A subject needs a name.');

  let slug = clean(req.body.slug, 40) || slugify(name);
  let guard = 0;
  while (get('SELECT 1 AS x FROM subjects WHERE slug = ?', slug) && guard < 50) {
    guard += 1;
    slug = `${slugify(name)}-${guard + 1}`;
  }

  const nextPosition = (get('SELECT COALESCE(MAX(position), -1) AS p FROM subjects').p ?? -1) + 1;
  const info = run(`
    INSERT INTO subjects (slug, name, description, icon, colour, cover_url, position, published, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  slug, name, bodyText(req.body.description, 600),
  ICONS.includes(req.body.icon) ? req.body.icon : 'code',
  COLOURS.includes(req.body.colour) ? req.body.colour : 'violet',
  clean(req.body.coverUrl || '', 500), nextPosition,
  req.body.published === false ? 0 : 1, req.user.id);

  logActivity(req.user.id, 'subject.created', 'subject', info.lastInsertRowid, name);
  res.status(201).json({ subject: serializeSubject(get('SELECT * FROM subjects WHERE id = ?', info.lastInsertRowid), req.user.id) });
}));

router.patch('/subjects/:id', requirePermission('subjects.edit'), wrap(async (req, res) => {
  const subject = get('SELECT * FROM subjects WHERE id = ?', Number(req.params.id));
  if (!subject) throw new HttpError(404, 'That subject could not be found.');

  const updates = [];
  const params = [];
  const set = (column, value) => { updates.push(`${column} = ?`); params.push(value); };

  if (req.body.name !== undefined) set('name', clean(req.body.name, 60) || subject.name);
  if (req.body.description !== undefined) set('description', bodyText(req.body.description, 600));
  if (req.body.icon !== undefined) set('icon', ICONS.includes(req.body.icon) ? req.body.icon : subject.icon);
  if (req.body.colour !== undefined) set('colour', COLOURS.includes(req.body.colour) ? req.body.colour : subject.colour);
  if (req.body.coverUrl !== undefined) set('cover_url', clean(req.body.coverUrl, 500));
  if (req.body.published !== undefined) set('published', req.body.published ? 1 : 0);

  if (updates.length) run(`UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`, ...params, subject.id);
  logActivity(req.user.id, 'subject.edited', 'subject', subject.id, subject.name);
  res.json({ subject: serializeSubject(get('SELECT * FROM subjects WHERE id = ?', subject.id), req.user.id) });
}));

router.post('/subjects/reorder', requirePermission('subjects.edit'), wrap(async (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number).filter(Boolean) : [];
  if (!order.length) throw new HttpError(400, 'Send the subject ids in their new order.');
  const update = db.prepare('UPDATE subjects SET position = ? WHERE id = ?');
  db.transaction(() => order.forEach((id, index) => update.run(index, id)))();
  logActivity(req.user.id, 'subjects.reordered', 'subject', '', `${order.length} subjects`);
  res.json({ ok: true });
}));

router.delete('/subjects/:id', requirePermission('subjects.delete'), wrap(async (req, res) => {
  const subject = get('SELECT * FROM subjects WHERE id = ?', Number(req.params.id));
  if (!subject) throw new HttpError(404, 'That subject could not be found.');

  const counts = get(`
    SELECT (SELECT COUNT(*) FROM topics WHERE subject_id = ?) AS topics,
           (SELECT COUNT(*) FROM lessons l JOIN topics t ON t.id = l.topic_id WHERE t.subject_id = ?) AS lessons
    `, subject.id, subject.id);

  run('DELETE FROM subjects WHERE id = ?', subject.id);
  logActivity(req.user.id, 'subject.deleted', 'subject', subject.id,
    `${subject.name} (${counts.topics} topics, ${counts.lessons} lessons)`);
  res.json({ ok: true, removed: counts });
}));

// ===========================================================================
// Topics
// ===========================================================================
router.get('/topics', requirePermission('subjects.view'), wrap(async (req, res) => {
  const subjectId = Number(req.query.subject) || 0;
  const rows = all(`
    SELECT t.*, s.name AS subject_name, s.slug AS subject_slug FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    ${subjectId ? 'WHERE t.subject_id = ?' : ''}
    ORDER BY s.position, t.position, t.id`, ...(subjectId ? [subjectId] : []));
  res.json({
    topics: rows.map((t) => serializeTopic(t, req.user.id)),
    subjects: all('SELECT id, name, slug FROM subjects ORDER BY position, id')
  });
}));

router.post('/topics', requirePermission('topics.create'), wrap(async (req, res) => {
  const subject = get('SELECT * FROM subjects WHERE id = ?', Number(req.body.subjectId));
  if (!subject) throw new HttpError(404, 'Choose a subject for the topic.');
  const name = clean(req.body.name, 80);
  if (!name) throw new HttpError(400, 'A topic needs a name.');

  let slug = clean(req.body.slug, 60) || slugify(name);
  let guard = 1;
  while (get('SELECT 1 AS x FROM topics WHERE subject_id = ? AND slug = ?', subject.id, slug) && guard < 50) {
    guard += 1;
    slug = `${slugify(name)}-${guard}`;
  }

  const nextPosition = (get('SELECT COALESCE(MAX(position), -1) AS p FROM topics WHERE subject_id = ?', subject.id).p ?? -1) + 1;
  const info = run(`
    INSERT INTO topics (subject_id, slug, name, description, position, published)
    VALUES (?, ?, ?, ?, ?, ?)`,
  subject.id, slug, name, bodyText(req.body.description, 600), nextPosition,
  req.body.published === false ? 0 : 1);

  logActivity(req.user.id, 'topic.created', 'topic', info.lastInsertRowid, `${subject.name}: ${name}`);
  const row = get(`
    SELECT t.*, s.name AS subject_name, s.slug AS subject_slug FROM topics t
    JOIN subjects s ON s.id = t.subject_id WHERE t.id = ?`, info.lastInsertRowid);
  res.status(201).json({ topic: serializeTopic(row, req.user.id) });
}));

router.patch('/topics/:id', requirePermission('topics.edit'), wrap(async (req, res) => {
  const topic = get('SELECT * FROM topics WHERE id = ?', Number(req.params.id));
  if (!topic) throw new HttpError(404, 'That topic could not be found.');

  const updates = [];
  const params = [];
  const set = (column, value) => { updates.push(`${column} = ?`); params.push(value); };

  if (req.body.name !== undefined) set('name', clean(req.body.name, 80) || topic.name);
  if (req.body.description !== undefined) set('description', bodyText(req.body.description, 600));
  if (req.body.published !== undefined) set('published', req.body.published ? 1 : 0);
  if (req.body.subjectId !== undefined) {
    const target = get('SELECT id FROM subjects WHERE id = ?', Number(req.body.subjectId));
    if (target) set('subject_id', target.id);
  }

  if (updates.length) run(`UPDATE topics SET ${updates.join(', ')} WHERE id = ?`, ...params, topic.id);
  logActivity(req.user.id, 'topic.edited', 'topic', topic.id, topic.name);
  const row = get(`
    SELECT t.*, s.name AS subject_name, s.slug AS subject_slug FROM topics t
    JOIN subjects s ON s.id = t.subject_id WHERE t.id = ?`, topic.id);
  res.json({ topic: serializeTopic(row, req.user.id) });
}));

router.post('/topics/reorder', requirePermission('topics.edit'), wrap(async (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number).filter(Boolean) : [];
  if (!order.length) throw new HttpError(400, 'Send the topic ids in their new order.');
  const update = db.prepare('UPDATE topics SET position = ? WHERE id = ?');
  db.transaction(() => order.forEach((id, index) => update.run(index, id)))();
  res.json({ ok: true });
}));

router.delete('/topics/:id', requirePermission('topics.delete'), wrap(async (req, res) => {
  const topic = get('SELECT * FROM topics WHERE id = ?', Number(req.params.id));
  if (!topic) throw new HttpError(404, 'That topic could not be found.');
  const counts = get(`
    SELECT (SELECT COUNT(*) FROM lessons WHERE topic_id = ?) AS lessons,
           (SELECT COUNT(*) FROM questions WHERE topic_id = ?) AS questions`, topic.id, topic.id);
  run('DELETE FROM topics WHERE id = ?', topic.id);
  logActivity(req.user.id, 'topic.deleted', 'topic', topic.id,
    `${topic.name} (${counts.lessons} lessons, ${counts.questions} questions)`);
  res.json({ ok: true, removed: counts });
}));

// ===========================================================================
// Lessons
// ===========================================================================
router.get('/lessons', requirePermission('subjects.view'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 200);
  const where = ['1 = 1'];
  const params = [];

  const subjectId = Number(req.query.subject) || 0;
  const topicId = Number(req.query.topic) || 0;
  const status = clean(req.query.status || '', 20);
  const search = clean(req.query.search || '', 60);

  if (subjectId) { where.push('t.subject_id = ?'); params.push(subjectId); }
  if (topicId) { where.push('l.topic_id = ?'); params.push(topicId); }
  if (['draft', 'published'].includes(status)) { where.push('l.status = ?'); params.push(status); }
  if (search) { where.push('(l.title LIKE ? OR l.summary LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const rows = all(`
    SELECT l.* FROM lessons l JOIN topics t ON t.id = l.topic_id JOIN subjects s ON s.id = t.subject_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.position, t.position, l.position, l.id LIMIT ? OFFSET ?`, ...params, limit, offset);

  res.json({
    lessons: rows.map((l) => serializeLesson(l, req.user.id)),
    total: get(`SELECT COUNT(*) AS n FROM lessons l JOIN topics t ON t.id = l.topic_id
                WHERE ${where.join(' AND ')}`, ...params).n,
    subjects: all('SELECT id, name FROM subjects ORDER BY position, id')
  });
}));

router.get('/lessons/:id', requirePermission('subjects.view'), wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');
  res.json({
    lesson: serializeLesson(lesson, req.user.id, { full: true }),
    versions: all('SELECT id, version, note, created_at, saved_by FROM lesson_versions WHERE lesson_id = ? ORDER BY version DESC', lesson.id)
      .map((v) => ({
        id: v.id, version: v.version, note: v.note, createdAt: v.created_at,
        savedBy: v.saved_by ? userById(v.saved_by) : null
      }))
  });
}));

router.post('/lessons', requirePermission('lessons.create'), wrap(async (req, res) => {
  const topic = get('SELECT * FROM topics WHERE id = ?', Number(req.body.topicId));
  if (!topic) throw new HttpError(404, 'Choose a topic for the lesson.');
  const title = clean(req.body.title, 160);
  if (!title) throw new HttpError(400, 'A lesson needs a title.');

  const nextPosition = (get('SELECT COALESCE(MAX(position), -1) AS p FROM lessons WHERE topic_id = ?', topic.id).p ?? -1) + 1;
  const info = run(`
    INSERT INTO lessons (topic_id, title, summary, objectives, body, minutes, xp_reward, position, status, version, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  topic.id, title, bodyText(req.body.summary, 500), linesToText(req.body.objectives),
  JSON.stringify(sanitiseBlocks(req.body.blocks)),
  Math.min(240, Math.max(1, Number(req.body.minutes) || 10)),
  Math.min(500, Math.max(0, Number(req.body.xpReward) || 25)),
  nextPosition,
  req.body.status === 'published' && can(req.user, 'lessons.edit') ? 'published' : 'draft',
  req.user.id);

  logActivity(req.user.id, 'lesson.created', 'lesson', info.lastInsertRowid, title);
  res.status(201).json({ lesson: serializeLesson(get('SELECT * FROM lessons WHERE id = ?', info.lastInsertRowid), req.user.id, { full: true }) });
}));

router.patch('/lessons/:id', requirePermission('lessons.edit'), wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');

  // Keep the version that is about to be replaced.
  run(`INSERT INTO lesson_versions (lesson_id, version, title, summary, objectives, body, note, saved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(lesson_id, version) DO NOTHING`,
  lesson.id, lesson.version, lesson.title, lesson.summary, lesson.objectives, lesson.body,
  clean(req.body.versionNote || '', 200), req.user.id);

  const updates = ['version = version + 1', "updated_at = datetime('now')"];
  const params = [];
  const set = (column, value) => { updates.push(`${column} = ?`); params.push(value); };

  if (req.body.title !== undefined) set('title', clean(req.body.title, 160) || lesson.title);
  if (req.body.summary !== undefined) set('summary', bodyText(req.body.summary, 500));
  if (req.body.objectives !== undefined) set('objectives', linesToText(req.body.objectives));
  if (req.body.blocks !== undefined) set('body', JSON.stringify(sanitiseBlocks(req.body.blocks)));
  if (req.body.minutes !== undefined) set('minutes', Math.min(240, Math.max(1, Number(req.body.minutes) || lesson.minutes)));
  if (req.body.xpReward !== undefined) set('xp_reward', Math.min(500, Math.max(0, Number(req.body.xpReward) || 0)));
  if (req.body.status !== undefined) set('status', req.body.status === 'published' ? 'published' : 'draft');
  if (req.body.topicId !== undefined) {
    const topic = get('SELECT id FROM topics WHERE id = ?', Number(req.body.topicId));
    if (topic) set('topic_id', topic.id);
  }

  run(`UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`, ...params, lesson.id);
  logActivity(req.user.id, 'lesson.edited', 'lesson', lesson.id, lesson.title);
  res.json({ lesson: serializeLesson(get('SELECT * FROM lessons WHERE id = ?', lesson.id), req.user.id, { full: true }) });
}));

router.post('/lessons/:id/duplicate', requirePermission('lessons.create'), wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');

  const nextPosition = (get('SELECT COALESCE(MAX(position), -1) AS p FROM lessons WHERE topic_id = ?', lesson.topic_id).p ?? -1) + 1;
  const info = run(`
    INSERT INTO lessons (topic_id, title, summary, objectives, body, minutes, xp_reward, position, status, version, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?)`,
  lesson.topic_id, `${lesson.title} (copy)`, lesson.summary, lesson.objectives, lesson.body,
  lesson.minutes, lesson.xp_reward, nextPosition, req.user.id);

  for (const challenge of all('SELECT * FROM challenges WHERE lesson_id = ? ORDER BY position', lesson.id)) {
    run(`INSERT INTO challenges (lesson_id, title, description, requirements, starter_code, expected_result, hints, difficulty, points, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    info.lastInsertRowid, challenge.title, challenge.description, challenge.requirements,
    challenge.starter_code, challenge.expected_result, challenge.hints, challenge.difficulty,
    challenge.points, challenge.position);
  }

  logActivity(req.user.id, 'lesson.duplicated', 'lesson', info.lastInsertRowid, lesson.title);
  res.status(201).json({ lesson: serializeLesson(get('SELECT * FROM lessons WHERE id = ?', info.lastInsertRowid), req.user.id, { full: true }) });
}));

router.post('/lessons/reorder', requirePermission('lessons.edit'), wrap(async (req, res) => {
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number).filter(Boolean) : [];
  if (!order.length) throw new HttpError(400, 'Send the lesson ids in their new order.');
  const update = db.prepare('UPDATE lessons SET position = ? WHERE id = ?');
  db.transaction(() => order.forEach((id, index) => update.run(index, id)))();
  res.json({ ok: true });
}));

router.post('/lessons/:id/restore/:version', requirePermission('lessons.edit'), wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');
  const version = get('SELECT * FROM lesson_versions WHERE lesson_id = ? AND version = ?',
    lesson.id, Number(req.params.version));
  if (!version) throw new HttpError(404, 'That version could not be found.');

  // The current wording becomes a version of its own before it is replaced.
  run(`INSERT INTO lesson_versions (lesson_id, version, title, summary, objectives, body, note, saved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(lesson_id, version) DO NOTHING`,
  lesson.id, lesson.version, lesson.title, lesson.summary, lesson.objectives, lesson.body,
  'Replaced by a restore', req.user.id);

  run(`UPDATE lessons SET title = ?, summary = ?, objectives = ?, body = ?,
       version = version + 1, updated_at = datetime('now') WHERE id = ?`,
  version.title, version.summary, version.objectives, version.body, lesson.id);

  logActivity(req.user.id, 'lesson.version_restored', 'lesson', lesson.id, `restored version ${version.version}`);
  res.json({ lesson: serializeLesson(get('SELECT * FROM lessons WHERE id = ?', lesson.id), req.user.id, { full: true }) });
}));

router.get('/lessons/:id/versions/:version', requirePermission('subjects.view'), wrap(async (req, res) => {
  const version = get('SELECT * FROM lesson_versions WHERE lesson_id = ? AND version = ?',
    Number(req.params.id), Number(req.params.version));
  if (!version) throw new HttpError(404, 'That version could not be found.');
  res.json({
    version: {
      version: version.version,
      title: version.title,
      summary: version.summary,
      objectives: String(version.objectives || '').split('\n').filter(Boolean),
      blocks: parseBlocks(version.body),
      note: version.note,
      createdAt: version.created_at,
      savedBy: version.saved_by ? userById(version.saved_by) : null
    }
  });
}));

router.delete('/lessons/:id', requirePermission('lessons.delete'), wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');
  run('DELETE FROM lessons WHERE id = ?', lesson.id);
  logActivity(req.user.id, 'lesson.deleted', 'lesson', lesson.id, lesson.title);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Coding challenges
// ---------------------------------------------------------------------------
router.post('/lessons/:id/challenges', requirePermission('lessons.edit'), wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');
  const title = clean(req.body.title, 160);
  if (!title) throw new HttpError(400, 'A challenge needs a title.');

  const nextPosition = (get('SELECT COALESCE(MAX(position), -1) AS p FROM challenges WHERE lesson_id = ?', lesson.id).p ?? -1) + 1;
  const info = run(`
    INSERT INTO challenges (lesson_id, title, description, requirements, starter_code, expected_result, hints, difficulty, points, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  lesson.id, title, bodyText(req.body.description, 3000), linesToText(req.body.requirements),
  String(req.body.starterCode ?? '').slice(0, 20000), bodyText(req.body.expectedResult, 2000),
  linesToText(req.body.hints, 10),
  DIFFICULTIES.includes(req.body.difficulty) ? req.body.difficulty : 'beginner',
  Math.min(200, Math.max(0, Number(req.body.points) || 20)), nextPosition);

  logActivity(req.user.id, 'challenge.created', 'challenge', info.lastInsertRowid, title);
  res.status(201).json({ challenge: serializeChallenge(get('SELECT * FROM challenges WHERE id = ?', info.lastInsertRowid), req.user.id) });
}));

router.patch('/challenges/:id', requirePermission('lessons.edit'), wrap(async (req, res) => {
  const challenge = get('SELECT * FROM challenges WHERE id = ?', Number(req.params.id));
  if (!challenge) throw new HttpError(404, 'That challenge could not be found.');

  const updates = [];
  const params = [];
  const set = (column, value) => { updates.push(`${column} = ?`); params.push(value); };

  if (req.body.title !== undefined) set('title', clean(req.body.title, 160) || challenge.title);
  if (req.body.description !== undefined) set('description', bodyText(req.body.description, 3000));
  if (req.body.requirements !== undefined) set('requirements', linesToText(req.body.requirements));
  if (req.body.starterCode !== undefined) set('starter_code', String(req.body.starterCode ?? '').slice(0, 20000));
  if (req.body.expectedResult !== undefined) set('expected_result', bodyText(req.body.expectedResult, 2000));
  if (req.body.hints !== undefined) set('hints', linesToText(req.body.hints, 10));
  if (req.body.difficulty !== undefined && DIFFICULTIES.includes(req.body.difficulty)) set('difficulty', req.body.difficulty);
  if (req.body.points !== undefined) set('points', Math.min(200, Math.max(0, Number(req.body.points) || 0)));

  if (updates.length) run(`UPDATE challenges SET ${updates.join(', ')} WHERE id = ?`, ...params, challenge.id);
  logActivity(req.user.id, 'challenge.edited', 'challenge', challenge.id, challenge.title);
  res.json({ challenge: serializeChallenge(get('SELECT * FROM challenges WHERE id = ?', challenge.id), req.user.id) });
}));

router.delete('/challenges/:id', requirePermission('lessons.delete'), wrap(async (req, res) => {
  const challenge = get('SELECT * FROM challenges WHERE id = ?', Number(req.params.id));
  if (!challenge) throw new HttpError(404, 'That challenge could not be found.');
  run('DELETE FROM challenges WHERE id = ?', challenge.id);
  logActivity(req.user.id, 'challenge.deleted', 'challenge', challenge.id, challenge.title);
  res.json({ ok: true });
}));

// ===========================================================================
// The question bank
// ===========================================================================
function questionFilters(query) {
  const where = ['1 = 1'];
  const params = [];

  const subjectId = Number(query.subject) || 0;
  const topicId = Number(query.topic) || 0;
  const difficulty = clean(query.difficulty || '', 20);
  const type = clean(query.type || '', 30);
  const status = clean(query.status || '', 20);
  const search = clean(query.search || '', 60);

  if (subjectId) { where.push('t.subject_id = ?'); params.push(subjectId); }
  if (topicId) { where.push('q.topic_id = ?'); params.push(topicId); }
  if (DIFFICULTIES.includes(difficulty)) { where.push('q.difficulty = ?'); params.push(difficulty); }
  if (QUESTION_TYPES.includes(type)) { where.push('q.type = ?'); params.push(type); }
  if (status === 'published') where.push('q.published = 1');
  if (status === 'unpublished') where.push('q.published = 0');
  if (search) { where.push('(q.prompt LIKE ? OR q.tags LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  return { where: where.join(' AND '), params };
}

router.get('/questions', requirePermission('subjects.view'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 25, 200);
  const { where, params } = questionFilters(req.query);

  const rows = all(`
    SELECT q.*, t.name AS topic_name, s.name AS subject_name, s.slug AS subject_slug
    FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
    WHERE ${where}
    ORDER BY s.position, t.position, q.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);

  res.json({
    // Administrators editing the bank need to see the correct answers.
    questions: rows.map((q) => serializeQuestion(q, { reveal: true })),
    total: get(`SELECT COUNT(*) AS n FROM questions q JOIN topics t ON t.id = q.topic_id WHERE ${where}`, ...params).n,
    subjects: all('SELECT id, name FROM subjects ORDER BY position, id'),
    types: QUESTION_TYPES,
    difficulties: DIFFICULTIES,
    counts: {
      total: get('SELECT COUNT(*) AS n FROM questions').n,
      published: get('SELECT COUNT(*) AS n FROM questions WHERE published = 1').n
    }
  });
}));

/** Validates one question payload for both create and import. */
function questionValues(body, fallback = {}) {
  const type = QUESTION_TYPES.includes(body.type) ? body.type : (fallback.type || 'multiple_choice');
  const prompt = clean(body.prompt ?? fallback.prompt, 2000);
  if (!prompt) throw new HttpError(400, 'A question needs a prompt.');

  const options = Array.isArray(body.options)
    ? body.options.slice(0, 10).map((o) => clean(o, 600)).filter((o) => o !== '')
    : (fallback.options || []);

  const needsOptions = ['multiple_choice', 'output', 'debug', 'scenario'].includes(type);
  if (needsOptions && options.length < 2) {
    throw new HttpError(400, 'That question type needs at least two options.');
  }

  let answer = String(body.answer ?? fallback.answer ?? '').trim();
  if (needsOptions) {
    const index = Number(answer);
    if (!Number.isInteger(index) || index < 0 || index >= options.length) {
      throw new HttpError(400, 'Choose which option is the correct answer.');
    }
    answer = String(index);
  } else if (type === 'true_false') {
    answer = ['true', 't', 'yes', '1'].includes(answer.toLowerCase()) ? 'true' : 'false';
  } else if (!answer) {
    throw new HttpError(400, 'A question needs a correct answer.');
  }

  return {
    type,
    prompt,
    code: String(body.code ?? fallback.code ?? '').slice(0, 8000),
    options_json: JSON.stringify(needsOptions ? options : []),
    answer: answer.slice(0, 500),
    explanation: clean(body.explanation ?? fallback.explanation ?? '', 2000),
    difficulty: DIFFICULTIES.includes(body.difficulty) ? body.difficulty : (fallback.difficulty || 'beginner'),
    points: Math.min(200, Math.max(0, Number(body.points ?? fallback.points) || 10)),
    tags: clean(body.tags ?? fallback.tags ?? '', 200),
    published: body.published === false ? 0 : 1
  };
}

router.post('/questions', requirePermission('questions.create'), wrap(async (req, res) => {
  const topic = get('SELECT * FROM topics WHERE id = ?', Number(req.body.topicId));
  if (!topic) throw new HttpError(404, 'Choose a topic for the question.');

  const values = questionValues(req.body);
  const info = run(`
    INSERT INTO questions (topic_id, type, prompt, code, options_json, answer, explanation, difficulty, points, tags, published, created_by)
    VALUES (@topic_id, @type, @prompt, @code, @options_json, @answer, @explanation, @difficulty, @points, @tags, @published, @created_by)`,
  { ...values, topic_id: topic.id, created_by: req.user.id });

  logActivity(req.user.id, 'question.created', 'question', info.lastInsertRowid, values.prompt.slice(0, 80));
  res.status(201).json({ question: serializeQuestion(get('SELECT * FROM questions WHERE id = ?', info.lastInsertRowid), { reveal: true }) });
}));

/**
 * The "write 20 questions" tool. The administrator types every question
 * themselves; this endpoint simply saves the batch in one go.
 */
router.post('/questions/batch', requirePermission('questions.create'), wrap(async (req, res) => {
  const topic = get('SELECT * FROM topics WHERE id = ?', Number(req.body.topicId));
  if (!topic) throw new HttpError(404, 'Choose a topic for the questions.');
  const incoming = Array.isArray(req.body.questions) ? req.body.questions.slice(0, 100) : [];
  if (!incoming.length) throw new HttpError(400, 'Send at least one question.');

  const insert = db.prepare(`
    INSERT INTO questions (topic_id, type, prompt, code, options_json, answer, explanation, difficulty, points, tags, published, created_by)
    VALUES (@topic_id, @type, @prompt, @code, @options_json, @answer, @explanation, @difficulty, @points, @tags, @published, @created_by)`);

  const created = [];
  const failed = [];
  incoming.forEach((raw, index) => {
    try {
      const values = questionValues(raw, { difficulty: req.body.difficulty, type: req.body.type });
      const info = insert.run({ ...values, topic_id: topic.id, created_by: req.user.id });
      created.push(info.lastInsertRowid);
    } catch (err) {
      failed.push({ index, error: err.message });
    }
  });

  logActivity(req.user.id, 'questions.batch_created', 'topic', topic.id, `${created.length} questions in ${topic.name}`);
  res.status(201).json({ created: created.length, failed });
}));

router.patch('/questions/:id', requirePermission('questions.edit'), wrap(async (req, res) => {
  const question = get('SELECT * FROM questions WHERE id = ?', Number(req.params.id));
  if (!question) throw new HttpError(404, 'That question could not be found.');

  let existingOptions = [];
  try { existingOptions = JSON.parse(question.options_json || '[]'); } catch { existingOptions = []; }

  const values = questionValues({
    type: req.body.type ?? question.type,
    prompt: req.body.prompt ?? question.prompt,
    code: req.body.code ?? question.code,
    options: req.body.options ?? existingOptions,
    answer: req.body.answer ?? question.answer,
    explanation: req.body.explanation ?? question.explanation,
    difficulty: req.body.difficulty ?? question.difficulty,
    points: req.body.points ?? question.points,
    tags: req.body.tags ?? question.tags,
    published: req.body.published ?? !!question.published
  });

  const topicId = req.body.topicId !== undefined
    ? (get('SELECT id FROM topics WHERE id = ?', Number(req.body.topicId))?.id ?? question.topic_id)
    : question.topic_id;

  run(`UPDATE questions SET topic_id = @topic_id, type = @type, prompt = @prompt, code = @code,
       options_json = @options_json, answer = @answer, explanation = @explanation,
       difficulty = @difficulty, points = @points, tags = @tags, published = @published,
       updated_at = datetime('now') WHERE id = @id`,
  { ...values, topic_id: topicId, id: question.id });

  logActivity(req.user.id, 'question.edited', 'question', question.id, values.prompt.slice(0, 80));
  res.json({ question: serializeQuestion(get('SELECT * FROM questions WHERE id = ?', question.id), { reveal: true }) });
}));

router.post('/questions/:id/duplicate', requirePermission('questions.create'), wrap(async (req, res) => {
  const question = get('SELECT * FROM questions WHERE id = ?', Number(req.params.id));
  if (!question) throw new HttpError(404, 'That question could not be found.');
  const info = run(`
    INSERT INTO questions (topic_id, type, prompt, code, options_json, answer, explanation, difficulty, points, tags, published, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  question.topic_id, question.type, `${question.prompt}`, question.code, question.options_json,
  question.answer, question.explanation, question.difficulty, question.points, question.tags, req.user.id);
  res.status(201).json({ question: serializeQuestion(get('SELECT * FROM questions WHERE id = ?', info.lastInsertRowid), { reveal: true }) });
}));

router.delete('/questions/:id', requirePermission('questions.delete'), wrap(async (req, res) => {
  const question = get('SELECT * FROM questions WHERE id = ?', Number(req.params.id));
  if (!question) throw new HttpError(404, 'That question could not be found.');
  run('DELETE FROM questions WHERE id = ?', question.id);
  logActivity(req.user.id, 'question.deleted', 'question', question.id, question.prompt.slice(0, 80));
  res.json({ ok: true });
}));

/** Bulk actions on a set of selected questions. */
router.post('/questions/bulk', requirePermission('questions.edit'), wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean).slice(0, 500) : [];
  if (!ids.length) throw new HttpError(400, 'Select at least one question.');
  const action = String(req.body.action || '');
  const marks = ids.map(() => '?').join(',');

  let changed = 0;
  if (action === 'delete') {
    if (!can(req.user, 'questions.delete')) throw new HttpError(403, 'You cannot delete questions.');
    changed = run(`DELETE FROM questions WHERE id IN (${marks})`, ...ids).changes;
  } else if (action === 'publish' || action === 'unpublish') {
    changed = run(`UPDATE questions SET published = ?, updated_at = datetime('now') WHERE id IN (${marks})`,
      action === 'publish' ? 1 : 0, ...ids).changes;
  } else if (action === 'difficulty') {
    if (!DIFFICULTIES.includes(req.body.difficulty)) throw new HttpError(400, 'Choose a difficulty.');
    changed = run(`UPDATE questions SET difficulty = ?, updated_at = datetime('now') WHERE id IN (${marks})`,
      req.body.difficulty, ...ids).changes;
  } else if (action === 'points') {
    const points = Math.min(200, Math.max(0, Number(req.body.points) || 0));
    changed = run(`UPDATE questions SET points = ?, updated_at = datetime('now') WHERE id IN (${marks})`, points, ...ids).changes;
  } else if (action === 'move') {
    const topic = get('SELECT id, name FROM topics WHERE id = ?', Number(req.body.topicId));
    if (!topic) throw new HttpError(404, 'Choose a topic to move them to.');
    changed = run(`UPDATE questions SET topic_id = ?, updated_at = datetime('now') WHERE id IN (${marks})`, topic.id, ...ids).changes;
  } else {
    throw new HttpError(400, 'That bulk action is not supported.');
  }

  logActivity(req.user.id, `questions.bulk_${action}`, 'question', '', `${changed} questions`);
  res.json({ ok: true, changed });
}));

/** Export the current filter selection as JSON the import endpoint understands. */
router.get('/questions/export', requirePermission('questions.import'), wrap(async (req, res) => {
  const { where, params } = questionFilters(req.query);
  const rows = all(`
    SELECT q.*, t.slug AS topic_slug, s.slug AS subject_slug
    FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
    WHERE ${where} ORDER BY s.position, t.position, q.id`, ...params);

  logActivity(req.user.id, 'questions.exported', 'question', '', `${rows.length} questions`);
  res.json({
    format: 'coding-hub-questions',
    version: 1,
    exportedAt: new Date().toISOString(),
    questions: rows.map((q) => {
      let options = [];
      try { options = JSON.parse(q.options_json || '[]'); } catch { options = []; }
      return {
        subject: q.subject_slug,
        topic: q.topic_slug,
        type: q.type,
        prompt: q.prompt,
        code: q.code || undefined,
        options: options.length ? options : undefined,
        answer: q.answer,
        explanation: q.explanation || undefined,
        difficulty: q.difficulty,
        points: q.points,
        tags: q.tags || undefined,
        published: !!q.published
      };
    })
  });
}));

router.post('/questions/import', requirePermission('questions.import'), wrap(async (req, res) => {
  const incoming = Array.isArray(req.body.questions) ? req.body.questions.slice(0, 2000) : [];
  if (!incoming.length) throw new HttpError(400, 'The file contained no questions.');

  const findTopic = db.prepare(`
    SELECT t.id FROM topics t JOIN subjects s ON s.id = t.subject_id
    WHERE t.slug = ? AND s.slug = ?`);
  const findTopicById = db.prepare('SELECT id FROM topics WHERE id = ?');
  const insert = db.prepare(`
    INSERT INTO questions (topic_id, type, prompt, code, options_json, answer, explanation, difficulty, points, tags, published, created_by)
    VALUES (@topic_id, @type, @prompt, @code, @options_json, @answer, @explanation, @difficulty, @points, @tags, @published, @created_by)`);
  const duplicate = db.prepare('SELECT id FROM questions WHERE topic_id = ? AND prompt = ? AND code = ?');

  const fallbackTopicId = Number(req.body.topicId) || 0;
  const skipDuplicates = req.body.skipDuplicates !== false;

  let created = 0;
  let skipped = 0;
  const failed = [];

  db.transaction(() => {
    incoming.forEach((raw, index) => {
      try {
        const topic = (raw.topic && raw.subject && findTopic.get(String(raw.topic), String(raw.subject)))
          || (fallbackTopicId && findTopicById.get(fallbackTopicId));
        if (!topic) {
          failed.push({ index, error: 'No matching topic. Add subject and topic slugs, or choose a topic to import into.' });
          return;
        }
        const values = questionValues(raw);
        if (skipDuplicates && duplicate.get(topic.id, values.prompt, values.code)) { skipped += 1; return; }
        insert.run({ ...values, topic_id: topic.id, created_by: req.user.id });
        created += 1;
      } catch (err) {
        failed.push({ index, error: err.message });
      }
    });
  })();

  logActivity(req.user.id, 'questions.imported', 'question', '', `${created} created, ${skipped} skipped, ${failed.length} failed`);
  res.json({ created, skipped, failed });
}));

// ===========================================================================
// Learning analytics
// ===========================================================================
router.get('/analytics', requirePermission('analytics.view'), wrap(async (_req, res) => {
  const n = (sql, ...p) => get(sql, ...p).n;

  res.json({
    totals: {
      subjects: n('SELECT COUNT(*) AS n FROM subjects'),
      publishedSubjects: n('SELECT COUNT(*) AS n FROM subjects WHERE published = 1'),
      topics: n('SELECT COUNT(*) AS n FROM topics'),
      lessons: n('SELECT COUNT(*) AS n FROM lessons'),
      publishedLessons: n("SELECT COUNT(*) AS n FROM lessons WHERE status = 'published'"),
      draftLessons: n("SELECT COUNT(*) AS n FROM lessons WHERE status = 'draft'"),
      challenges: n('SELECT COUNT(*) AS n FROM challenges'),
      questions: n('SELECT COUNT(*) AS n FROM questions'),
      publishedQuestions: n('SELECT COUNT(*) AS n FROM questions WHERE published = 1'),
      lessonsCompleted: n("SELECT COUNT(*) AS n FROM lesson_progress WHERE status = 'completed'"),
      questionsAnswered: n('SELECT COUNT(*) AS n FROM question_attempts'),
      challengesCompleted: n('SELECT COUNT(*) AS n FROM challenge_completions'),
      learners: n('SELECT COUNT(DISTINCT user_id) AS n FROM lesson_progress')
    },

    averageAccuracy: (() => {
      const row = get('SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct FROM question_attempts');
      return row.total ? Math.round((row.correct / row.total) * 100) : 0;
    })(),

    popularSubjects: all(`
      SELECT s.name, COUNT(lp.lesson_id) AS opens
      FROM subjects s
      JOIN topics t ON t.subject_id = s.id
      JOIN lessons l ON l.topic_id = t.id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
      GROUP BY s.id ORDER BY opens DESC LIMIT 6`),

    hardestTopics: all(`
      SELECT t.name, s.name AS subject_name, COUNT(*) AS answered,
             COALESCE(SUM(qa.correct), 0) AS correct
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      JOIN topics t ON t.id = q.topic_id
      JOIN subjects s ON s.id = t.subject_id
      GROUP BY t.id HAVING answered >= 5
      ORDER BY (CAST(correct AS REAL) / answered) ASC LIMIT 8`)
      .map((r) => ({ ...r, accuracy: Math.round((r.correct / r.answered) * 100) })),

    thinnestTopics: all(`
      SELECT t.id, t.name, s.name AS subject_name,
             (SELECT COUNT(*) FROM questions WHERE topic_id = t.id) AS questions,
             (SELECT COUNT(*) FROM lessons WHERE topic_id = t.id) AS lessons
      FROM topics t JOIN subjects s ON s.id = t.subject_id
      WHERE t.published = 1
      ORDER BY questions ASC, lessons ASC, s.position, t.position LIMIT 10`),

    topLearners: all(`
      SELECT u.id, COUNT(DISTINCT lp.lesson_id) AS lessons,
             (SELECT COUNT(*) FROM question_attempts WHERE user_id = u.id) AS answered
      FROM users u
      JOIN lesson_progress lp ON lp.user_id = u.id AND lp.status = 'completed'
      WHERE u.status = 'active'
      GROUP BY u.id ORDER BY lessons DESC, answered DESC LIMIT 10`)
      .map((r) => ({ user: userById(r.id), lessonsCompleted: r.lessons, questionsAnswered: r.answered })),

    recentAttempts: all(`
      SELECT qa.created_at, qa.correct, qa.user_id, q.prompt, t.name AS topic_name
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      JOIN topics t ON t.id = q.topic_id
      ORDER BY qa.id DESC LIMIT 15`)
      .map((r) => ({
        user: userById(r.user_id),
        prompt: r.prompt,
        topicName: r.topic_name,
        correct: !!r.correct,
        createdAt: r.created_at
      }))
  });
}));

/** One learner's progress, for the member detail screen. */
router.get('/learners/:id', requirePermission('analytics.view'), wrap(async (req, res) => {
  const user = userById(Number(req.params.id));
  if (!user) throw new HttpError(404, 'That member could not be found.');
  const { learnerStats, subjectBreakdown } = await import('../lib/learn.js');
  res.json({
    user,
    stats: learnerStats(user.id),
    breakdown: subjectBreakdown(user.id)
  });
}));
