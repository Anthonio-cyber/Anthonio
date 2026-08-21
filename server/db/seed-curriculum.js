// ==========================================================
// Copies the starting curriculum into the database.
//
// It runs once. After that a flag in the settings table stops it,
// so anything an administrator edits, unpublishes or deletes stays
// that way instead of reappearing on the next restart.
// ==========================================================
import { SUBJECT_CATALOGUE, topicSlug } from './curriculum.js';

import html from './content/html.js';
import css from './content/css.js';
import javascript from './content/javascript.js';
import python from './content/python.js';
import git from './content/git.js';
import react from './content/react.js';

const CONTENT = [html, css, javascript, python, git, react];

const SEED_FLAG = 'curriculum_seeded_version';
const SEED_VERSION = '1';

const QUESTION_TYPES = new Set([
  'multiple_choice', 'true_false', 'fill_blank', 'code', 'output', 'debug', 'scenario'
]);
const DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced']);

/**
 * Writes the starter subjects, topics, lessons, challenges and questions.
 * Safe to call on every boot: it returns immediately once it has run.
 */
export function seedCurriculum(db) {
  const flag = db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_FLAG);
  if (flag?.value === SEED_VERSION) return { skipped: true };

  const insertSubject = db.prepare(`
    INSERT INTO subjects (slug, name, description, icon, colour, position, published)
    VALUES (@slug, @name, @description, @icon, @colour, @position, 1)
    ON CONFLICT(slug) DO NOTHING`);
  const findSubject = db.prepare('SELECT id FROM subjects WHERE slug = ?');

  const insertTopic = db.prepare(`
    INSERT INTO topics (subject_id, slug, name, description, position, published)
    VALUES (@subject_id, @slug, @name, '', @position, 1)
    ON CONFLICT(subject_id, slug) DO NOTHING`);
  const findTopic = db.prepare('SELECT id FROM topics WHERE subject_id = ? AND slug = ?');

  const findLesson = db.prepare('SELECT id FROM lessons WHERE topic_id = ? AND title = ?');
  const insertLesson = db.prepare(`
    INSERT INTO lessons (topic_id, title, summary, objectives, body, minutes, xp_reward, position, status, version)
    VALUES (@topic_id, @title, @summary, @objectives, @body, @minutes, @xp_reward, @position, 'published', 1)`);

  const insertChallenge = db.prepare(`
    INSERT INTO challenges (lesson_id, title, description, requirements, starter_code, expected_result, hints, difficulty, points, position)
    VALUES (@lesson_id, @title, @description, @requirements, @starter_code, @expected_result, @hints, @difficulty, @points, 0)`);

  // Two questions can share a prompt ("What is logged?") and differ only in
  // their code sample, so the code is part of the identity check.
  const findQuestion = db.prepare('SELECT id FROM questions WHERE topic_id = ? AND prompt = ? AND code = ?');
  const insertQuestion = db.prepare(`
    INSERT INTO questions (topic_id, type, prompt, code, options_json, answer, explanation, difficulty, points, tags, published)
    VALUES (@topic_id, @type, @prompt, @code, @options_json, @answer, @explanation, @difficulty, @points, @tags, 1)`);

  const counts = { subjects: 0, topics: 0, lessons: 0, challenges: 0, questions: 0 };

  db.transaction(() => {
    // ---- Structure ------------------------------------------------------
    const subjectIds = new Map();
    SUBJECT_CATALOGUE.forEach((subject, subjectIndex) => {
      insertSubject.run({
        slug: subject.slug,
        name: subject.name,
        description: subject.description,
        icon: subject.icon,
        colour: subject.colour,
        position: subjectIndex
      });
      const subjectId = findSubject.get(subject.slug).id;
      subjectIds.set(subject.slug, subjectId);
      counts.subjects += 1;

      subject.topics.forEach((topicName, topicIndex) => {
        insertTopic.run({
          subject_id: subjectId,
          slug: topicSlug(topicName),
          name: topicName,
          position: topicIndex
        });
        counts.topics += 1;
      });
    });

    // ---- Lessons, challenges and questions -------------------------------
    for (const pack of CONTENT) {
      const subjectId = subjectIds.get(pack.subject);
      if (!subjectId) continue;

      const positionByTopic = new Map();

      for (const lesson of pack.lessons) {
        const topic = findTopic.get(subjectId, topicSlug(lesson.topic));
        if (!topic) continue;
        if (findLesson.get(topic.id, lesson.title)) continue;

        const position = positionByTopic.get(topic.id) ?? 0;
        positionByTopic.set(topic.id, position + 1);

        const info = insertLesson.run({
          topic_id: topic.id,
          title: lesson.title,
          summary: lesson.summary || '',
          objectives: (lesson.objectives || []).join('\n'),
          body: JSON.stringify(lesson.blocks || []),
          minutes: lesson.minutes || 10,
          xp_reward: lesson.xpReward || 25,
          position
        });
        counts.lessons += 1;

        if (lesson.challenge) {
          const c = lesson.challenge;
          insertChallenge.run({
            lesson_id: info.lastInsertRowid,
            title: c.title,
            description: c.description || '',
            requirements: (c.requirements || []).join('\n'),
            starter_code: c.starterCode || '',
            expected_result: c.expectedResult || '',
            hints: (c.hints || []).join('\n'),
            difficulty: DIFFICULTIES.has(c.difficulty) ? c.difficulty : 'beginner',
            points: Number(c.points) || 20
          });
          counts.challenges += 1;
        }
      }

      for (const question of pack.questions) {
        const topic = findTopic.get(subjectId, topicSlug(question.topic));
        if (!topic) continue;
        if (findQuestion.get(topic.id, question.prompt, question.code || '')) continue;

        insertQuestion.run({
          topic_id: topic.id,
          type: QUESTION_TYPES.has(question.type) ? question.type : 'multiple_choice',
          prompt: question.prompt,
          code: question.code || '',
          options_json: JSON.stringify(question.options || []),
          answer: String(question.answer),
          explanation: question.explanation || '',
          difficulty: DIFFICULTIES.has(question.difficulty) ? question.difficulty : 'beginner',
          points: Number(question.points) || 10,
          tags: question.tags || ''
        });
        counts.questions += 1;
      }
    }

    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(SEED_FLAG, SEED_VERSION);
  })();

  return counts;
}
