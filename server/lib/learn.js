// ==========================================================
// Coding Hub - shared helpers for the learning platform.
//
// Two rules run through this file:
//   1. A learner never receives the correct answer to a question
//      they have not answered yet. Marking happens on the server.
//   2. Unpublished (draft) material is invisible unless the viewer
//      holds a permission that lets them see it.
// ==========================================================
import { get, all, run, getSetting } from '../db/index.js';
import { userById } from './serialize.js';
import { awardXp, grantAchievement } from './xp.js';

export const QUESTION_TYPES = [
  'multiple_choice', 'true_false', 'fill_blank', 'code', 'output', 'debug', 'scenario'
];
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
export const BOOKMARK_KINDS = ['lesson', 'topic', 'question', 'challenge'];

/** Types where the stored answer is the index of the correct option. */
const CHOICE_TYPES = new Set(['multiple_choice', 'output', 'debug', 'scenario']);

export const xpSetting = (key, fallback) => {
  const value = Number(getSetting(key, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
};

const lines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Subjects and topics
// ---------------------------------------------------------------------------
export function serializeSubject(row, viewerId = null) {
  const counts = get(`
    SELECT
      (SELECT COUNT(*) FROM topics WHERE subject_id = ?) AS topics,
      (SELECT COUNT(*) FROM topics WHERE subject_id = ? AND published = 1) AS published_topics,
      (SELECT COUNT(*) FROM lessons l JOIN topics t ON t.id = l.topic_id
        WHERE t.subject_id = ? AND l.status = 'published' AND t.published = 1) AS lessons,
      (SELECT COUNT(*) FROM questions q JOIN topics t ON t.id = q.topic_id
        WHERE t.subject_id = ? AND q.published = 1 AND t.published = 1) AS questions
    `, row.id, row.id, row.id, row.id);

  const completed = viewerId
    ? get(`
      SELECT COUNT(*) AS n FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id
      JOIN topics t ON t.id = l.topic_id
      WHERE t.subject_id = ? AND lp.user_id = ? AND lp.status = 'completed'
        AND l.status = 'published'`, row.id, viewerId).n
    : 0;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    icon: row.icon || 'code',
    colour: row.colour || 'violet',
    coverUrl: row.cover_url || '',
    position: row.position,
    published: !!row.published,
    topicCount: counts.published_topics,
    totalTopicCount: counts.topics,
    lessonCount: counts.lessons,
    questionCount: counts.questions,
    lessonsCompleted: completed,
    percentComplete: counts.lessons ? Math.round((completed / counts.lessons) * 100) : 0
  };
}

export function serializeTopic(row, viewerId = null) {
  const counts = get(`
    SELECT
      (SELECT COUNT(*) FROM lessons WHERE topic_id = ? AND status = 'published') AS lessons,
      (SELECT COUNT(*) FROM lessons WHERE topic_id = ?) AS all_lessons,
      (SELECT COUNT(*) FROM questions WHERE topic_id = ? AND published = 1) AS questions,
      (SELECT COUNT(*) FROM questions WHERE topic_id = ?) AS all_questions
    `, row.id, row.id, row.id, row.id);

  const completed = viewerId
    ? get(`
      SELECT COUNT(*) AS n FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id
      WHERE l.topic_id = ? AND lp.user_id = ? AND lp.status = 'completed' AND l.status = 'published'`,
    row.id, viewerId).n
    : 0;

  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subject_name || '',
    subjectSlug: row.subject_slug || '',
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    position: row.position,
    published: !!row.published,
    lessonCount: counts.lessons,
    totalLessonCount: counts.all_lessons,
    questionCount: counts.questions,
    totalQuestionCount: counts.all_questions,
    lessonsCompleted: completed,
    percentComplete: counts.lessons ? Math.round((completed / counts.lessons) * 100) : 0,
    bookmarked: viewerId ? isBookmarked(viewerId, 'topic', row.id) : false
  };
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------
export function serializeLesson(row, viewerId = null, { full = false } = {}) {
  const topic = get(`
    SELECT t.*, s.name AS subject_name, s.slug AS subject_slug, s.id AS subject_id, s.colour
    FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE t.id = ?`, row.topic_id);

  const progress = viewerId
    ? get('SELECT status, completed_at FROM lesson_progress WHERE lesson_id = ? AND user_id = ?', row.id, viewerId)
    : null;

  const lesson = {
    id: row.id,
    topicId: row.topic_id,
    topicName: topic?.name || '',
    subjectId: topic?.subject_id || null,
    subjectName: topic?.subject_name || '',
    subjectSlug: topic?.subject_slug || '',
    colour: topic?.colour || 'violet',
    title: row.title,
    summary: row.summary || '',
    objectives: lines(row.objectives),
    minutes: row.minutes,
    xpReward: row.xp_reward,
    position: row.position,
    status: row.status,
    version: row.version,
    createdBy: row.created_by ? userById(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myStatus: progress?.status || 'not_started',
    completedAt: progress?.completed_at || null,
    bookmarked: viewerId ? isBookmarked(viewerId, 'lesson', row.id) : false,
    questionCount: get('SELECT COUNT(*) AS n FROM questions WHERE topic_id = ? AND published = 1', row.topic_id).n
  };

  if (full) {
    lesson.blocks = parseBlocks(row.body);
    lesson.challenges = all('SELECT * FROM challenges WHERE lesson_id = ? ORDER BY position, id', row.id)
      .map((c) => serializeChallenge(c, viewerId));
    lesson.neighbours = neighbours(row);
  }
  return lesson;
}

export function parseBlocks(body) {
  try {
    const parsed = JSON.parse(body || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The previous and next published lesson within the same subject. */
function neighbours(row) {
  const ordered = all(`
    SELECT l.id, l.title FROM lessons l
    JOIN topics t ON t.id = l.topic_id
    WHERE t.subject_id = (SELECT subject_id FROM topics WHERE id = ?)
      AND l.status = 'published' AND t.published = 1
    ORDER BY t.position, l.position, l.id`, row.topic_id);
  const index = ordered.findIndex((l) => l.id === row.id);
  return {
    previous: index > 0 ? ordered[index - 1] : null,
    next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null
  };
}

export function serializeChallenge(row, viewerId = null) {
  const done = viewerId
    ? get('SELECT completed_at, solution FROM challenge_completions WHERE challenge_id = ? AND user_id = ?', row.id, viewerId)
    : null;
  return {
    id: row.id,
    lessonId: row.lesson_id,
    title: row.title,
    description: row.description || '',
    requirements: lines(row.requirements),
    starterCode: row.starter_code || '',
    expectedResult: row.expected_result || '',
    hints: lines(row.hints),
    difficulty: row.difficulty,
    points: row.points,
    completed: !!done,
    completedAt: done?.completed_at || null,
    solution: done?.solution || '',
    bookmarked: viewerId ? isBookmarked(viewerId, 'challenge', row.id) : false
  };
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
/**
 * `reveal` must only ever be true for an administrator editing the bank,
 * or for a learner who has just submitted an answer to this question.
 */
export function serializeQuestion(row, { reveal = false, viewerId = null } = {}) {
  let options = [];
  try { options = JSON.parse(row.options_json || '[]'); } catch { options = []; }

  const question = {
    id: row.id,
    topicId: row.topic_id,
    topicName: row.topic_name || '',
    subjectName: row.subject_name || '',
    subjectSlug: row.subject_slug || '',
    type: row.type,
    prompt: row.prompt,
    code: row.code || '',
    options,
    difficulty: row.difficulty,
    points: row.points,
    tags: row.tags || '',
    published: !!row.published,
    bookmarked: viewerId ? isBookmarked(viewerId, 'question', row.id) : false
  };

  if (reveal) {
    question.answer = row.answer;
    question.explanation = row.explanation || '';
    question.createdAt = row.created_at;
    question.updatedAt = row.updated_at;
    question.createdBy = row.created_by ? userById(row.created_by) : null;
  }
  return question;
}

const normalise = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/^["'`]+|["'`;.]+$/g, '')
  .trim();

/**
 * Marks an answer. This is the only place marking happens, so a learner
 * cannot award themselves points by editing the page.
 */
export function checkAnswer(question, submitted) {
  const expected = String(question.answer ?? '');

  if (CHOICE_TYPES.has(question.type)) {
    return String(submitted).trim() === expected.trim();
  }
  if (question.type === 'true_false') {
    const value = normalise(submitted);
    const truthy = ['true', 't', 'yes', '1'];
    const falsy = ['false', 'f', 'no', '0'];
    const expectedTrue = truthy.includes(normalise(expected));
    if (truthy.includes(value)) return expectedTrue;
    if (falsy.includes(value)) return !expectedTrue;
    return false;
  }
  // fill_blank and code: accept any of several answers separated by |
  const accepted = expected.split('|').map(normalise).filter(Boolean);
  return accepted.includes(normalise(submitted));
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------
export function isBookmarked(userId, kind, refId) {
  return !!get('SELECT 1 AS x FROM learn_bookmarks WHERE user_id = ? AND kind = ? AND ref_id = ?', userId, kind, refId);
}

// ---------------------------------------------------------------------------
// Progress and statistics
// ---------------------------------------------------------------------------
export function learnerStats(userId) {
  const lessons = get(`
    SELECT COUNT(*) AS n FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.user_id = ? AND lp.status = 'completed'`, userId).n;

  const totalLessons = get(`
    SELECT COUNT(*) AS n FROM lessons l JOIN topics t ON t.id = l.topic_id JOIN subjects s ON s.id = t.subject_id
    WHERE l.status = 'published' AND t.published = 1 AND s.published = 1`).n;

  const attempts = get(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(correct), 0) AS correct,
           COALESCE(SUM(points_awarded), 0) AS points
    FROM question_attempts WHERE user_id = ?`, userId);

  const challenges = get('SELECT COUNT(*) AS n FROM challenge_completions WHERE user_id = ?', userId).n;

  return {
    lessonsCompleted: lessons,
    lessonsAvailable: totalLessons,
    questionsAnswered: attempts.n,
    correctAnswers: attempts.correct,
    accuracy: attempts.n ? Math.round((attempts.correct / attempts.n) * 100) : 0,
    pointsFromQuestions: attempts.points,
    challengesCompleted: challenges,
    currentStreak: answerStreak(userId)
  };
}

/** How many questions in a row the learner has answered correctly. */
export function answerStreak(userId) {
  const recent = all('SELECT correct FROM question_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 200', userId);
  let streak = 0;
  for (const row of recent) {
    if (!row.correct) break;
    streak += 1;
  }
  return streak;
}

export function subjectBreakdown(userId) {
  return all(`
    SELECT s.id, s.name, s.slug, s.colour,
      (SELECT COUNT(*) FROM lessons l JOIN topics t ON t.id = l.topic_id
        WHERE t.subject_id = s.id AND l.status = 'published' AND t.published = 1) AS lessons,
      (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
         JOIN topics t ON t.id = l.topic_id
       WHERE t.subject_id = s.id AND lp.user_id = ? AND lp.status = 'completed') AS completed,
      (SELECT COUNT(*) FROM question_attempts qa JOIN questions q ON q.id = qa.question_id
         JOIN topics t ON t.id = q.topic_id
       WHERE t.subject_id = s.id AND qa.user_id = ?) AS answered,
      (SELECT COALESCE(SUM(qa.correct), 0) FROM question_attempts qa JOIN questions q ON q.id = qa.question_id
         JOIN topics t ON t.id = q.topic_id
       WHERE t.subject_id = s.id AND qa.user_id = ?) AS correct
    FROM subjects s
    WHERE s.published = 1
    ORDER BY s.position, s.id`, userId, userId, userId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      colour: r.colour,
      lessons: r.lessons,
      completed: r.completed,
      percentComplete: r.lessons ? Math.round((r.completed / r.lessons) * 100) : 0,
      answered: r.answered,
      correct: r.correct,
      accuracy: r.answered ? Math.round((r.correct / r.answered) * 100) : 0
    }));
}

/** The lesson to offer under "Continue learning". */
export function continueLearning(userId) {
  const inProgress = get(`
    SELECT l.* FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    JOIN topics t ON t.id = l.topic_id
    WHERE lp.user_id = ? AND lp.status != 'completed' AND l.status = 'published' AND t.published = 1
    ORDER BY lp.opened_at DESC LIMIT 1`, userId);
  if (inProgress) return serializeLesson(inProgress, userId);

  const next = get(`
    SELECT l.* FROM lessons l
    JOIN topics t ON t.id = l.topic_id
    JOIN subjects s ON s.id = t.subject_id
    LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
    WHERE l.status = 'published' AND t.published = 1 AND s.published = 1 AND lp.lesson_id IS NULL
    ORDER BY s.position, t.position, l.position, l.id LIMIT 1`, userId);
  return next ? serializeLesson(next, userId) : null;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
export function checkQuestionBadges(userId) {
  const answered = get('SELECT COUNT(*) AS n FROM question_attempts WHERE user_id = ?', userId).n;
  if (answered >= 1000) grantAchievement(userId, 'questions_1000');
  if (answered >= 500) grantAchievement(userId, 'questions_500');
  if (answered >= 100) grantAchievement(userId, 'questions_100');
  if (answerStreak(userId) >= 25) grantAchievement(userId, 'sharp_shooter');
}

/** Awards the "<Subject> Master" badge once every published lesson is done. */
export function checkSubjectMastery(userId, subjectId) {
  const subject = get('SELECT slug FROM subjects WHERE id = ?', subjectId);
  if (!subject) return;
  const key = `master_${subject.slug}`;
  if (!get('SELECT 1 AS x FROM achievements WHERE key = ?', key)) return;

  const totals = get(`
    SELECT
      (SELECT COUNT(*) FROM lessons l JOIN topics t ON t.id = l.topic_id
        WHERE t.subject_id = ? AND l.status = 'published' AND t.published = 1) AS total,
      (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
         JOIN topics t ON t.id = l.topic_id
       WHERE t.subject_id = ? AND lp.user_id = ? AND lp.status = 'completed' AND l.status = 'published') AS done
    `, subjectId, subjectId, userId);

  if (totals.total > 0 && totals.done >= totals.total) grantAchievement(userId, key);
}

/** Marks a lesson complete, pays the XP once, and checks for new badges. */
export function completeLesson(userId, lesson) {
  const existing = get('SELECT status FROM lesson_progress WHERE lesson_id = ? AND user_id = ?', lesson.id, userId);
  const alreadyDone = existing?.status === 'completed';

  run(`INSERT INTO lesson_progress (lesson_id, user_id, status, completed_at)
       VALUES (?, ?, 'completed', datetime('now'))
       ON CONFLICT(lesson_id, user_id) DO UPDATE SET status = 'completed', completed_at = datetime('now')`,
  lesson.id, userId);

  if (alreadyDone) return { xpAwarded: 0, alreadyComplete: true };

  const xp = lesson.xp_reward || xpSetting('xp_lesson_complete', 25);
  awardXp(userId, xp, 'lesson');
  grantAchievement(userId, 'first_lesson');

  const topic = get('SELECT subject_id FROM topics WHERE id = ?', lesson.topic_id);
  if (topic) checkSubjectMastery(userId, topic.subject_id);

  return { xpAwarded: xp, alreadyComplete: false };
}

export function openLesson(userId, lessonId) {
  run(`INSERT INTO lesson_progress (lesson_id, user_id, status, opened_at)
       VALUES (?, ?, 'opened', datetime('now'))
       ON CONFLICT(lesson_id, user_id) DO UPDATE SET opened_at = datetime('now')`,
  lessonId, userId);
}
