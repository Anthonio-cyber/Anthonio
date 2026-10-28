import express from 'express';
import { db, get, all, run, logActivity } from '../db/index.js';
import { requireAuth, requirePermission, can } from '../lib/auth.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { awardXp, xpValue, grantAchievement } from '../lib/xp.js';
import { userById } from '../lib/serialize.js';
import { KINDS, KIND_KEYS, isKind, markAnswer, prepareQuestion } from '../lib/question-kinds.js';

export const router = express.Router();
router.use(requireAuth);

const DIFFICULTIES = ['easy', 'medium', 'hard'];

function shapeQuestion(row, { withAnswer = false } = {}) {
  let options = [];
  try { options = JSON.parse(row.options_json); } catch { options = []; }
  const kind = isKind(row.kind) ? row.kind : 'multiple_choice';
  const shaped = {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    topicId: row.topic_id || null,
    topic: row.topic_name || row.topic || '',
    kind,
    kindLabel: KINDS[kind].label,
    difficulty: row.difficulty,
    question: row.question,
    codeSnippet: row.code_snippet || '',
    // A blank has nothing to choose from, so no options are sent.
    options: kind === 'fill_blank' ? [] : options
  };
  // The right answer is never sent to the browser before it is needed.
  if (withAnswer) {
    shaped.answerIndex = row.answer_index;
    shaped.explanation = row.explanation || '';
    if (kind === 'fill_blank') {
      try { shaped.accepted = JSON.parse(row.accepted_json || '[]'); } catch { shaped.accepted = []; }
    }
  }
  return shaped;
}

/** How a member is doing in one subject. */
function subjectProgress(subjectId, userId) {
  const total = get(
    'SELECT COUNT(*) AS n FROM practice_questions WHERE subject_id = ? AND is_deleted = 0', subjectId
  ).n;
  const row = get(`
    SELECT COUNT(DISTINCT a.question_id) AS attempted,
           COUNT(DISTINCT CASE WHEN a.correct = 1 THEN a.question_id END) AS correct
    FROM practice_attempts a
    JOIN practice_questions q ON q.id = a.question_id AND q.is_deleted = 0
    WHERE a.user_id = ? AND q.subject_id = ?`, userId, subjectId);

  const attempted = row?.attempted || 0;
  const correct = row?.correct || 0;
  return {
    total,
    attempted,
    correct,
    remaining: Math.max(0, total - attempted),
    percent: total ? Math.round((correct / total) * 100) : 0
  };
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
router.get('/subjects', wrap(async (req, res) => {
  const rows = all('SELECT * FROM subjects WHERE is_active = 1 ORDER BY sort_order, name');
  const subjects = rows.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    description: s.description || '',
    progress: subjectProgress(s.id, req.user.id)
  }));

  const overall = get(`
    SELECT COUNT(*) AS answered,
           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct
    FROM practice_attempts WHERE user_id = ?`, req.user.id);

  res.json({
    subjects,
    overall: {
      answered: overall?.answered || 0,
      correct: overall?.correct || 0,
      accuracy: overall?.answered ? Math.round((overall.correct / overall.answered) * 100) : 0
    },
    canManage: can(req.user, 'practice.manage'),
    xpPerCorrect: xpValue('xp_practice_correct', 3)
  });
}));

// ---------------------------------------------------------------------------
// A practice set
// ---------------------------------------------------------------------------
router.get('/subjects/:id/questions', wrap(async (req, res) => {
  const subject = get('SELECT * FROM subjects WHERE id = ? AND is_active = 1', Number(req.params.id));
  if (!subject) throw new HttpError(404, 'That subject could not be found.');

  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
  const difficulty = DIFFICULTIES.includes(req.query.difficulty) ? req.query.difficulty : null;
  const onlyUnseen = req.query.mode === 'new';
  const onlyWrong = req.query.mode === 'wrong';

  const where = ['q.subject_id = ?', 'q.is_deleted = 0'];
  const params = [subject.id];
  if (difficulty) { where.push('q.difficulty = ?'); params.push(difficulty); }
  if (req.query.topicId) { where.push('q.topic_id = ?'); params.push(Number(req.query.topicId)); }
  if (isKind(req.query.kind)) { where.push('q.kind = ?'); params.push(req.query.kind); }

  if (onlyUnseen) {
    where.push('q.id NOT IN (SELECT question_id FROM practice_attempts WHERE user_id = ?)');
    params.push(req.user.id);
  } else if (onlyWrong) {
    // Questions last answered wrongly, so they can be put right.
    where.push(`q.id IN (
      SELECT a.question_id FROM practice_attempts a
      WHERE a.user_id = ? GROUP BY a.question_id
      HAVING MAX(CASE WHEN a.correct = 1 THEN 1 ELSE 0 END) = 0)`);
    params.push(req.user.id);
  }

  let rows = all(`
    SELECT q.*, s.name AS subject_name, t.name AS topic_name
    FROM practice_questions q
    JOIN subjects s ON s.id = q.subject_id
    LEFT JOIN topics t ON t.id = q.topic_id
    WHERE ${where.join(' AND ')}
    ORDER BY RANDOM() LIMIT ?`, ...params, limit);

  // If there is nothing new left, fall back to the whole subject so
  // practice never hits a dead end.
  let fellBack = false;
  if (!rows.length && (onlyUnseen || onlyWrong)) {
    fellBack = true;
    rows = all(`
      SELECT q.*, s.name AS subject_name, t.name AS topic_name
      FROM practice_questions q
      JOIN subjects s ON s.id = q.subject_id
      LEFT JOIN topics t ON t.id = q.topic_id
      WHERE q.subject_id = ? AND q.is_deleted = 0
      ORDER BY RANDOM() LIMIT ?`, subject.id, limit);
  }

  res.json({
    subject: { id: subject.id, name: subject.name, icon: subject.icon },
    questions: rows.map((r) => shapeQuestion(r)),
    fellBack,
    progress: subjectProgress(subject.id, req.user.id)
  });
}));

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------
router.post('/answer', wrap(async (req, res) => {
  const questionId = Number(req.body.questionId);
  const chosen = Number(req.body.chosenIndex);
  const row = get(`
    SELECT q.*, s.name AS subject_name, t.name AS topic_name
    FROM practice_questions q
    JOIN subjects s ON s.id = q.subject_id
    LEFT JOIN topics t ON t.id = q.topic_id
    WHERE q.id = ? AND q.is_deleted = 0`, questionId);
  if (!row) throw new HttpError(404, 'That question could not be found.');

  // A blank is typed; everything else is chosen from the options.
  const given = row.kind === 'fill_blank' ? String(req.body.answerText ?? '') : chosen;
  const marked = markAnswer(row, given);
  if (marked.invalid) throw new HttpError(400, 'Choose one of the answers.');
  const correct = marked.correct;

  // XP only the first time a question is answered correctly, so the
  // same question cannot be farmed for points.
  const alreadyRight = get(
    'SELECT 1 AS x FROM practice_attempts WHERE user_id = ? AND question_id = ? AND correct = 1',
    req.user.id, questionId
  );

  run('INSERT INTO practice_attempts (user_id, question_id, chosen_index, correct) VALUES (?, ?, ?, ?)',
    req.user.id, questionId, Number.isInteger(chosen) ? chosen : null, correct ? 1 : 0);

  let xpAwarded = 0;
  if (correct && !alreadyRight) {
    xpAwarded = xpValue('xp_practice_correct', 3);
    awardXp(req.user.id, xpAwarded, 'practice');

    const totalRight = get(
      'SELECT COUNT(DISTINCT question_id) AS n FROM practice_attempts WHERE user_id = ? AND correct = 1',
      req.user.id
    ).n;
    if (totalRight >= 25) grantAchievement(req.user.id, 'homework_hero');
  }

  res.json({
    correct,
    answerIndex: row.answer_index,
    expected: marked.expected || '',
    explanation: row.explanation || '',
    xpAwarded,
    alreadyAnswered: Boolean(alreadyRight),
    progress: subjectProgress(row.subject_id, req.user.id)
  });
}));

router.get('/stats', wrap(async (req, res) => {
  const perSubject = all(`
    SELECT s.id, s.name, s.icon,
           COUNT(a.id) AS answered,
           SUM(CASE WHEN a.correct = 1 THEN 1 ELSE 0 END) AS correct
    FROM subjects s
    LEFT JOIN practice_questions q ON q.subject_id = s.id AND q.is_deleted = 0
    LEFT JOIN practice_attempts a ON a.question_id = q.id AND a.user_id = ?
    WHERE s.is_active = 1
    GROUP BY s.id ORDER BY s.sort_order, s.name`, req.user.id);

  res.json({
    subjects: perSubject.map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      answered: s.answered || 0,
      correct: s.correct || 0,
      accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : 0,
      progress: subjectProgress(s.id, req.user.id)
    }))
  });
}));

// ---------------------------------------------------------------------------
// Teachers and administrators
// ---------------------------------------------------------------------------
router.post('/subjects', requirePermission('practice.manage'), wrap(async (req, res) => {
  const name = clean(req.body.name, 40);
  if (!name) throw new HttpError(400, 'Give the subject a name.');
  if (get('SELECT 1 AS x FROM subjects WHERE name = ?', name)) {
    throw new HttpError(409, 'That subject already exists.');
  }
  const info = run('INSERT INTO subjects (name, icon, description, sort_order) VALUES (?, ?, ?, ?)',
    name, clean(req.body.icon || 'book', 20), clean(req.body.description || '', 200),
    Number(req.body.sortOrder) || 99);
  logActivity(req.user.id, 'practice.subject_created', 'subject', info.lastInsertRowid, name);
  res.status(201).json({ id: info.lastInsertRowid });
}));

router.post('/questions', requirePermission('practice.manage'), wrap(async (req, res) => {
  const subjectId = Number(req.body.subjectId);
  if (!get('SELECT 1 AS x FROM subjects WHERE id = ?', subjectId)) {
    throw new HttpError(400, 'Choose a subject that exists.');
  }
  const question = clean(req.body.question, 500);
  if (!question) throw new HttpError(400, 'Write the question.');

  // A topic is optional, but if given it must belong to that subject.
  let topicId = null;
  let topicName = '';
  if (req.body.topicId) {
    const topic = get('SELECT * FROM topics WHERE id = ? AND subject_id = ?', Number(req.body.topicId), subjectId);
    if (!topic) throw new HttpError(400, 'That topic is not part of the subject you chose.');
    topicId = topic.id;
    topicName = topic.name;
  }

  const prepared = prepareQuestion(req.body, (message) => { throw new HttpError(400, message); });

  const info = run(`
    INSERT INTO practice_questions
      (subject_id, topic_id, topic, kind, difficulty, question, options_json, answer_index,
       accepted_json, code_snippet, explanation, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  subjectId, topicId, topicName, prepared.kind,
  DIFFICULTIES.includes(req.body.difficulty) ? req.body.difficulty : 'medium',
  question, prepared.options_json, prepared.answer_index,
  prepared.accepted_json, prepared.code_snippet,
  clean(req.body.explanation || '', 600), req.user.id);

  logActivity(req.user.id, 'practice.question_created', 'question', info.lastInsertRowid, question.slice(0, 60));
  res.status(201).json({ id: info.lastInsertRowid });
}));

/** The kinds of question a teacher can choose from. */
router.get('/kinds', wrap(async (_req, res) => {
  res.json({ kinds: KIND_KEYS.map((key) => ({ key, ...KINDS[key] })) });
}));

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------
router.get('/subjects/:id/topics', wrap(async (req, res) => {
  const subjectId = Number(req.params.id);
  const rows = all(`
    SELECT t.*,
           (SELECT COUNT(*) FROM practice_questions q
            WHERE q.topic_id = t.id AND q.is_deleted = 0) AS question_count
    FROM topics t WHERE t.subject_id = ? ORDER BY t.sort_order, t.name`, subjectId);

  res.json({
    topics: rows.map((t) => {
      const progress = get(`
        SELECT COUNT(DISTINCT a.question_id) AS attempted,
               COUNT(DISTINCT CASE WHEN a.correct = 1 THEN a.question_id END) AS correct
        FROM practice_attempts a
        JOIN practice_questions q ON q.id = a.question_id AND q.is_deleted = 0
        WHERE a.user_id = ? AND q.topic_id = ?`, req.user.id, t.id);
      return {
        id: t.id,
        name: t.name,
        description: t.description || '',
        questionCount: t.question_count,
        attempted: progress?.attempted || 0,
        correct: progress?.correct || 0
      };
    })
  });
}));

router.post('/subjects/:id/topics', requirePermission('practice.manage'), wrap(async (req, res) => {
  const subjectId = Number(req.params.id);
  if (!get('SELECT 1 AS x FROM subjects WHERE id = ?', subjectId)) {
    throw new HttpError(404, 'That subject could not be found.');
  }
  const name = clean(req.body.name, 60);
  if (!name) throw new HttpError(400, 'Give the topic a name.');
  if (get('SELECT 1 AS x FROM topics WHERE subject_id = ? AND name = ?', subjectId, name)) {
    throw new HttpError(409, 'That subject already has a topic with that name.');
  }
  const info = run('INSERT INTO topics (subject_id, name, description, sort_order) VALUES (?, ?, ?, ?)',
    subjectId, name, clean(req.body.description || '', 200), Number(req.body.sortOrder) || 99);
  logActivity(req.user.id, 'practice.topic_created', 'topic', info.lastInsertRowid, name);
  res.status(201).json({ id: info.lastInsertRowid, name });
}));

router.delete('/topics/:id', requirePermission('practice.manage'), wrap(async (req, res) => {
  const topic = get('SELECT * FROM topics WHERE id = ?', Number(req.params.id));
  if (!topic) throw new HttpError(404, 'That topic could not be found.');
  // Questions survive; they simply stop belonging to a topic.
  run('UPDATE practice_questions SET topic_id = NULL WHERE topic_id = ?', topic.id);
  run('DELETE FROM topics WHERE id = ?', topic.id);
  logActivity(req.user.id, 'practice.topic_deleted', 'topic', topic.id, topic.name);
  res.json({ ok: true });
}));

router.get('/questions', requirePermission('practice.manage'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 200);
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
  const rows = subjectId
    ? all(`SELECT q.*, s.name AS subject_name, t.name AS topic_name FROM practice_questions q
           JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics t ON t.id = q.topic_id
           WHERE q.is_deleted = 0 AND q.subject_id = ? ORDER BY q.id DESC LIMIT ? OFFSET ?`, subjectId, limit, offset)
    : all(`SELECT q.*, s.name AS subject_name, t.name AS topic_name FROM practice_questions q
           JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics t ON t.id = q.topic_id
           WHERE q.is_deleted = 0 ORDER BY q.id DESC LIMIT ? OFFSET ?`, limit, offset);
  res.json({
    questions: rows.map((r) => ({ ...shapeQuestion(r, { withAnswer: true }), createdBy: r.created_by ? userById(r.created_by) : null })),
    total: get('SELECT COUNT(*) AS n FROM practice_questions WHERE is_deleted = 0').n
  });
}));

router.delete('/questions/:id', requirePermission('practice.manage'), wrap(async (req, res) => {
  const row = get('SELECT * FROM practice_questions WHERE id = ?', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That question could not be found.');
  run('UPDATE practice_questions SET is_deleted = 1 WHERE id = ?', row.id);
  logActivity(req.user.id, 'practice.question_deleted', 'question', row.id, row.question.slice(0, 60));
  res.json({ ok: true });
}));
