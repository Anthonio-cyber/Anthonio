// ==========================================================
// Coding Hub - everything a learner does.
// Reading lessons, practising questions, completing challenges,
// bookmarks, history and progress.
//
// Draft material is filtered out here, and answers are marked here,
// so nothing depends on the browser behaving itself.
// ==========================================================
import express from 'express';
import { get, all, run, getSetting } from '../db/index.js';
import { requireAuth, can } from '../lib/auth.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { awardXp, grantAchievement } from '../lib/xp.js';
import {
  serializeSubject, serializeTopic, serializeLesson, serializeChallenge, serializeQuestion,
  checkAnswer, learnerStats, subjectBreakdown, continueLearning, completeLesson, openLesson,
  checkQuestionBadges, xpSetting, DIFFICULTIES, QUESTION_TYPES, BOOKMARK_KINDS
} from '../lib/learn.js';

export const router = express.Router();
router.use(requireAuth);

/** Administrators with subjects.view may also see unpublished material. */
const seesDrafts = (req) => can(req.user, 'subjects.view');

const hubEnabled = () => getSetting('coding_hub_enabled', 'true') !== 'false';

router.use((req, _res, next) => {
  if (!hubEnabled() && !can(req.user, 'subjects.view')) {
    return next(new HttpError(403, 'The Coding Hub is switched off at the moment.', 'coding_hub_disabled'));
  }
  return next();
});

// ---------------------------------------------------------------------------
// Overview - the learner's coding dashboard
// ---------------------------------------------------------------------------
router.get('/overview', wrap(async (req, res) => {
  const drafts = seesDrafts(req);
  const subjects = all(`
    SELECT * FROM subjects ${drafts ? '' : 'WHERE published = 1'}
    ORDER BY position, id`).map((s) => serializeSubject(s, req.user.id));

  res.json({
    name: getSetting('coding_hub_name', 'Coding Hub'),
    tagline: getSetting('coding_hub_tagline', ''),
    stats: learnerStats(req.user.id),
    continueLesson: continueLearning(req.user.id),
    subjects,
    breakdown: subjectBreakdown(req.user.id),
    recent: recentActivity(req.user.id, 8)
  });
}));

function recentActivity(userId, limit = 20) {
  const lessons = all(`
    SELECT lp.status, lp.opened_at, lp.completed_at, l.id, l.title, t.name AS topic_name, s.name AS subject_name
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    JOIN topics t ON t.id = l.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE lp.user_id = ?
    ORDER BY COALESCE(lp.completed_at, lp.opened_at) DESC LIMIT ?`, userId, limit)
    .map((r) => ({
      kind: r.status === 'completed' ? 'lesson_completed' : 'lesson_opened',
      at: r.completed_at || r.opened_at,
      title: r.title,
      subtitle: `${r.subject_name} - ${r.topic_name}`,
      link: `#/lesson/${r.id}`
    }));

  const challenges = all(`
    SELECT cc.completed_at, c.title, l.id AS lesson_id, s.name AS subject_name
    FROM challenge_completions cc
    JOIN challenges c ON c.id = cc.challenge_id
    JOIN lessons l ON l.id = c.lesson_id
    JOIN topics t ON t.id = l.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE cc.user_id = ? ORDER BY cc.completed_at DESC LIMIT ?`, userId, limit)
    .map((r) => ({
      kind: 'challenge_completed',
      at: r.completed_at,
      title: r.title,
      subtitle: `${r.subject_name} - coding challenge`,
      link: `#/lesson/${r.lesson_id}`
    }));

  return [...lessons, ...challenges]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Subjects and topics
// ---------------------------------------------------------------------------
router.get('/subjects', wrap(async (req, res) => {
  const rows = all(`
    SELECT * FROM subjects ${seesDrafts(req) ? '' : 'WHERE published = 1'}
    ORDER BY position, id`);
  res.json({
    subjects: rows.map((s) => serializeSubject(s, req.user.id)),
    stats: learnerStats(req.user.id)
  });
}));

router.get('/subjects/:key', wrap(async (req, res) => {
  const key = String(req.params.key);
  const subject = get('SELECT * FROM subjects WHERE id = ? OR slug = ?', Number(key) || 0, key);
  if (!subject) throw new HttpError(404, 'That subject could not be found.');
  if (!subject.published && !seesDrafts(req)) throw new HttpError(404, 'That subject could not be found.');

  const topics = all(`
    SELECT t.*, s.name AS subject_name, s.slug AS subject_slug FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE t.subject_id = ? ${seesDrafts(req) ? '' : 'AND t.published = 1'}
    ORDER BY t.position, t.id`, subject.id);

  res.json({
    subject: serializeSubject(subject, req.user.id),
    topics: topics.map((t) => serializeTopic(t, req.user.id))
  });
}));

router.get('/topics/:id', wrap(async (req, res) => {
  const topic = get(`
    SELECT t.*, s.name AS subject_name, s.slug AS subject_slug, s.published AS subject_published
    FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE t.id = ?`, Number(req.params.id));
  if (!topic) throw new HttpError(404, 'That topic could not be found.');
  if ((!topic.published || !topic.subject_published) && !seesDrafts(req)) {
    throw new HttpError(404, 'That topic could not be found.');
  }

  const lessons = all(`
    SELECT * FROM lessons WHERE topic_id = ? ${seesDrafts(req) ? '' : "AND status = 'published'"}
    ORDER BY position, id`, topic.id);

  const difficulties = all(`
    SELECT difficulty, COUNT(*) AS n FROM questions
    WHERE topic_id = ? AND published = 1 GROUP BY difficulty`, topic.id);

  res.json({
    topic: serializeTopic(topic, req.user.id),
    lessons: lessons.map((l) => serializeLesson(l, req.user.id)),
    questionsByDifficulty: Object.fromEntries(difficulties.map((d) => [d.difficulty, d.n]))
  });
}));

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------
router.get('/lessons/:id', wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');
  if (lesson.status !== 'published' && !seesDrafts(req)) throw new HttpError(404, 'That lesson could not be found.');

  if (lesson.status === 'published') openLesson(req.user.id, lesson.id);
  res.json({ lesson: serializeLesson(lesson, req.user.id, { full: true }) });
}));

router.post('/lessons/:id/complete', wrap(async (req, res) => {
  const lesson = get("SELECT * FROM lessons WHERE id = ? AND status = 'published'", Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');

  const result = completeLesson(req.user.id, lesson);
  res.json({
    ...result,
    lesson: serializeLesson(lesson, req.user.id),
    stats: learnerStats(req.user.id)
  });
}));

router.post('/lessons/:id/reopen', wrap(async (req, res) => {
  const lesson = get('SELECT * FROM lessons WHERE id = ?', Number(req.params.id));
  if (!lesson) throw new HttpError(404, 'That lesson could not be found.');
  run("UPDATE lesson_progress SET status = 'opened', completed_at = NULL WHERE lesson_id = ? AND user_id = ?",
    lesson.id, req.user.id);
  res.json({ lesson: serializeLesson(lesson, req.user.id) });
}));

// ---------------------------------------------------------------------------
// Coding challenges
// ---------------------------------------------------------------------------
router.get('/challenges', wrap(async (req, res) => {
  const rows = all(`
    SELECT c.*, l.title AS lesson_title, t.name AS topic_name, s.name AS subject_name, s.slug AS subject_slug
    FROM challenges c
    JOIN lessons l ON l.id = c.lesson_id
    JOIN topics t ON t.id = l.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE l.status = 'published' AND t.published = 1 AND s.published = 1
    ORDER BY s.position, t.position, l.position`);
  res.json({
    challenges: rows.map((row) => ({
      ...serializeChallenge(row, req.user.id),
      lessonTitle: row.lesson_title,
      topicName: row.topic_name,
      subjectName: row.subject_name
    }))
  });
}));

router.post('/challenges/:id/complete', wrap(async (req, res) => {
  const challenge = get('SELECT * FROM challenges WHERE id = ?', Number(req.params.id));
  if (!challenge) throw new HttpError(404, 'That challenge could not be found.');

  const already = get('SELECT 1 AS x FROM challenge_completions WHERE challenge_id = ? AND user_id = ?',
    challenge.id, req.user.id);

  run(`INSERT INTO challenge_completions (challenge_id, user_id, solution)
       VALUES (?, ?, ?)
       ON CONFLICT(challenge_id, user_id) DO UPDATE SET solution = excluded.solution`,
  challenge.id, req.user.id, clean(req.body.solution || '', 20000));

  let xpAwarded = 0;
  if (!already) {
    xpAwarded = challenge.points || xpSetting('xp_coding_challenge', 20);
    awardXp(req.user.id, xpAwarded, 'challenge');
    grantAchievement(req.user.id, 'first_challenge');
  }

  res.json({
    challenge: serializeChallenge(get('SELECT * FROM challenges WHERE id = ?', challenge.id), req.user.id),
    xpAwarded,
    alreadyComplete: !!already,
    stats: learnerStats(req.user.id)
  });
}));

router.post('/challenges/:id/reset', wrap(async (req, res) => {
  run('DELETE FROM challenge_completions WHERE challenge_id = ? AND user_id = ?',
    Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Practice - questions are sent WITHOUT their answers
// ---------------------------------------------------------------------------
router.get('/practice', wrap(async (req, res) => {
  const where = ['q.published = 1', 't.published = 1', 's.published = 1'];
  const params = [];

  const topicId = Number(req.query.topic) || 0;
  const subjectKey = clean(req.query.subject || '', 40);
  const difficulty = clean(req.query.difficulty || '', 20);
  const type = clean(req.query.type || '', 30);
  const search = clean(req.query.search || '', 60);

  if (topicId) { where.push('q.topic_id = ?'); params.push(topicId); }
  if (subjectKey) { where.push('(s.slug = ? OR s.id = ?)'); params.push(subjectKey, Number(subjectKey) || 0); }
  if (DIFFICULTIES.includes(difficulty)) { where.push('q.difficulty = ?'); params.push(difficulty); }
  if (QUESTION_TYPES.includes(type)) { where.push('q.type = ?'); params.push(type); }
  if (search) { where.push('q.prompt LIKE ?'); params.push(`%${search}%`); }

  const defaultCount = Number(getSetting('practice_question_count', '10')) || 10;
  const count = Math.min(50, Math.max(1, Number(req.query.count) || defaultCount));
  const unseen = req.query.unseen === '1' || req.query.unseen === 'true';
  if (unseen) {
    where.push('q.id NOT IN (SELECT question_id FROM question_attempts WHERE user_id = ?)');
    params.push(req.user.id);
  }

  const rows = all(`
    SELECT q.*, t.name AS topic_name, s.name AS subject_name, s.slug AS subject_slug
    FROM questions q
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE ${where.join(' AND ')}
    ORDER BY RANDOM() LIMIT ?`, ...params, count);

  const available = get(`
    SELECT COUNT(*) AS n FROM questions q
    JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
    WHERE ${where.join(' AND ')}`, ...params).n;

  res.json({
    questions: rows.map((r) => serializeQuestion(r, { viewerId: req.user.id })),
    available,
    filters: {
      subjects: all('SELECT id, slug, name FROM subjects WHERE published = 1 ORDER BY position, id'),
      difficulties: DIFFICULTIES,
      types: QUESTION_TYPES
    }
  });
}));

/** Marks one answer. The explanation only comes back after answering. */
router.post('/questions/:id/answer', wrap(async (req, res) => {
  const question = get(`
    SELECT q.*, t.subject_id FROM questions q
    JOIN topics t ON t.id = q.topic_id
    WHERE q.id = ? AND q.published = 1`, Number(req.params.id));
  if (!question) throw new HttpError(404, 'That question could not be found.');

  const submitted = clean(String(req.body.answer ?? ''), 500);
  const correct = checkAnswer(question, submitted);

  // XP is only paid the first time a question is answered correctly.
  const previouslyCorrect = get(
    'SELECT 1 AS x FROM question_attempts WHERE question_id = ? AND user_id = ? AND correct = 1',
    question.id, req.user.id);

  const points = correct && !previouslyCorrect
    ? (question.points || xpSetting('xp_correct_answer', 5))
    : 0;

  run('INSERT INTO question_attempts (question_id, user_id, answer, correct, points_awarded) VALUES (?, ?, ?, ?, ?)',
    question.id, req.user.id, submitted, correct ? 1 : 0, points);

  if (points) awardXp(req.user.id, points, 'question');
  checkQuestionBadges(req.user.id);

  res.json({
    correct,
    answer: question.answer,
    explanation: question.explanation || '',
    pointsAwarded: points,
    alreadyAnswered: !!previouslyCorrect,
    stats: learnerStats(req.user.id)
  });
}));

router.get('/questions/:id', wrap(async (req, res) => {
  const row = get(`
    SELECT q.*, t.name AS topic_name, s.name AS subject_name, s.slug AS subject_slug
    FROM questions q JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
    WHERE q.id = ? AND q.published = 1`, Number(req.params.id));
  if (!row) throw new HttpError(404, 'That question could not be found.');
  // Reveal the answer only once this learner has already answered it.
  const answered = get('SELECT 1 AS x FROM question_attempts WHERE question_id = ? AND user_id = ?', row.id, req.user.id);
  res.json({ question: serializeQuestion(row, { reveal: !!answered, viewerId: req.user.id }) });
}));

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------
router.get('/bookmarks', wrap(async (req, res) => {
  const rows = all('SELECT * FROM learn_bookmarks WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
  const bookmarks = [];

  for (const row of rows) {
    if (row.kind === 'lesson') {
      const lesson = get("SELECT * FROM lessons WHERE id = ? AND status = 'published'", row.ref_id);
      if (lesson) bookmarks.push({ kind: 'lesson', createdAt: row.created_at, item: serializeLesson(lesson, req.user.id) });
    } else if (row.kind === 'topic') {
      const topic = get(`
        SELECT t.*, s.name AS subject_name, s.slug AS subject_slug FROM topics t
        JOIN subjects s ON s.id = t.subject_id WHERE t.id = ? AND t.published = 1`, row.ref_id);
      if (topic) bookmarks.push({ kind: 'topic', createdAt: row.created_at, item: serializeTopic(topic, req.user.id) });
    } else if (row.kind === 'question') {
      const question = get(`
        SELECT q.*, t.name AS topic_name, s.name AS subject_name, s.slug AS subject_slug FROM questions q
        JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
        WHERE q.id = ? AND q.published = 1`, row.ref_id);
      if (question) bookmarks.push({ kind: 'question', createdAt: row.created_at, item: serializeQuestion(question, { viewerId: req.user.id }) });
    } else if (row.kind === 'challenge') {
      const challenge = get('SELECT * FROM challenges WHERE id = ?', row.ref_id);
      if (challenge) bookmarks.push({ kind: 'challenge', createdAt: row.created_at, item: serializeChallenge(challenge, req.user.id) });
    }
  }
  res.json({ bookmarks });
}));

router.post('/bookmarks', wrap(async (req, res) => {
  const kind = String(req.body.kind || '');
  const refId = Number(req.body.refId) || 0;
  if (!BOOKMARK_KINDS.includes(kind) || !refId) throw new HttpError(400, 'That cannot be bookmarked.');

  const existing = get('SELECT 1 AS x FROM learn_bookmarks WHERE user_id = ? AND kind = ? AND ref_id = ?',
    req.user.id, kind, refId);
  if (existing) {
    run('DELETE FROM learn_bookmarks WHERE user_id = ? AND kind = ? AND ref_id = ?', req.user.id, kind, refId);
    return res.json({ bookmarked: false });
  }
  run('INSERT INTO learn_bookmarks (user_id, kind, ref_id) VALUES (?, ?, ?)', req.user.id, kind, refId);
  return res.json({ bookmarked: true });
}));

// ---------------------------------------------------------------------------
// Progress and history
// ---------------------------------------------------------------------------
router.get('/progress', wrap(async (req, res) => {
  res.json({
    stats: learnerStats(req.user.id),
    breakdown: subjectBreakdown(req.user.id),
    continueLesson: continueLearning(req.user.id),
    byDifficulty: all(`
      SELECT q.difficulty, COUNT(*) AS answered, COALESCE(SUM(qa.correct), 0) AS correct
      FROM question_attempts qa JOIN questions q ON q.id = qa.question_id
      WHERE qa.user_id = ? GROUP BY q.difficulty`, req.user.id)
      .map((r) => ({
        difficulty: r.difficulty,
        answered: r.answered,
        correct: r.correct,
        accuracy: r.answered ? Math.round((r.correct / r.answered) * 100) : 0
      })),
    weakestTopics: all(`
      SELECT t.id, t.name, s.name AS subject_name, COUNT(*) AS answered,
             COALESCE(SUM(qa.correct), 0) AS correct
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      JOIN topics t ON t.id = q.topic_id
      JOIN subjects s ON s.id = t.subject_id
      WHERE qa.user_id = ?
      GROUP BY t.id HAVING answered >= 3
      ORDER BY (CAST(correct AS REAL) / answered) ASC LIMIT 5`, req.user.id)
      .map((r) => ({
        topicId: r.id,
        name: r.name,
        subjectName: r.subject_name,
        answered: r.answered,
        accuracy: Math.round((r.correct / r.answered) * 100)
      }))
  });
}));

router.get('/history', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 40, 200);
  const attempts = all(`
    SELECT qa.*, q.prompt, q.type, q.difficulty, t.name AS topic_name, s.name AS subject_name
    FROM question_attempts qa
    JOIN questions q ON q.id = qa.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE qa.user_id = ? ORDER BY qa.id DESC LIMIT ? OFFSET ?`, req.user.id, limit, offset);

  res.json({
    stats: learnerStats(req.user.id),
    activity: recentActivity(req.user.id, 40),
    attempts: attempts.map((a) => ({
      id: a.id,
      questionId: a.question_id,
      prompt: a.prompt,
      type: a.type,
      difficulty: a.difficulty,
      topicName: a.topic_name,
      subjectName: a.subject_name,
      answer: a.answer,
      correct: !!a.correct,
      pointsAwarded: a.points_awarded,
      createdAt: a.created_at
    })),
    total: get('SELECT COUNT(*) AS n FROM question_attempts WHERE user_id = ?', req.user.id).n
  });
}));

// ---------------------------------------------------------------------------
// Search across the published curriculum
// ---------------------------------------------------------------------------
router.get('/search', wrap(async (req, res) => {
  const term = clean(req.query.q || '', 60);
  if (term.length < 2) return res.json({ subjects: [], topics: [], lessons: [], questions: [] });
  const like = `%${term}%`;

  return res.json({
    subjects: all('SELECT * FROM subjects WHERE published = 1 AND (name LIKE ? OR description LIKE ?) LIMIT 5', like, like)
      .map((s) => serializeSubject(s, req.user.id)),
    topics: all(`
      SELECT t.*, s.name AS subject_name, s.slug AS subject_slug FROM topics t
      JOIN subjects s ON s.id = t.subject_id
      WHERE t.published = 1 AND s.published = 1 AND t.name LIKE ? LIMIT 10`, like)
      .map((t) => serializeTopic(t, req.user.id)),
    lessons: all(`
      SELECT l.* FROM lessons l JOIN topics t ON t.id = l.topic_id JOIN subjects s ON s.id = t.subject_id
      WHERE l.status = 'published' AND t.published = 1 AND s.published = 1
        AND (l.title LIKE ? OR l.summary LIKE ?) LIMIT 10`, like, like)
      .map((l) => serializeLesson(l, req.user.id)),
    questions: all(`
      SELECT q.*, t.name AS topic_name, s.name AS subject_name, s.slug AS subject_slug FROM questions q
      JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
      WHERE q.published = 1 AND t.published = 1 AND s.published = 1 AND q.prompt LIKE ? LIMIT 10`, like)
      .map((q) => serializeQuestion(q, { viewerId: req.user.id }))
  });
}));
