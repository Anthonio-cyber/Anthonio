// ==========================================================
// Coding Hub - one topic: its lessons and its question bank.
// ==========================================================
import { esc, delegate, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { toast } from '../lib/ui.js';
import { progressBar, difficultyBadge } from '../components/learn.js';

export default async function topicView({ mount, params }) {
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.learn.topic(Number(params.id));
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'search', title: 'Topic not found', text: err.message,
      action: '<a class="btn btn-primary" href="#/subjects">Back to subjects</a>'
    })}</div>`;
    return;
  }

  const { topic, lessons, questionsByDifficulty } = data;
  setPageTitle(topic.name);

  const difficultyChips = ['beginner', 'intermediate', 'advanced']
    .filter((d) => questionsByDifficulty[d])
    .map((d) => `
      <a class="chip" href="#/practice?topic=${topic.id}&difficulty=${d}">
        ${difficultyBadge(d)} ${questionsByDifficulty[d]}
      </a>`).join('');

  mount.innerHTML = `
    <div class="page page-wide">
      <a class="back-link" href="#/subject/${esc(topic.subjectSlug)}">${icon('arrowLeft', 15)} ${esc(topic.subjectName)}</a>

      <header class="page-head">
        <div>
          <h1>${esc(topic.name)}</h1>
          <p class="muted">${esc(topic.description || `Part of ${topic.subjectName}.`)}</p>
          ${topic.lessonCount ? progressBar(topic.percentComplete, `${topic.lessonsCompleted} of ${plural(topic.lessonCount, 'lesson')} completed`) : ''}
        </div>
        <button type="button" class="btn btn-ghost ${topic.bookmarked ? 'active' : ''}" data-bookmark>
          ${icon('bookmark', 16)} ${topic.bookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </header>

      <div class="card">
        <div class="card-header">
          <span class="card-title-icon">${icon('book', 17)}</span>
          <h3>Lessons</h3>
        </div>
        ${lessons.length
    ? `<div class="list">${lessons.map(lessonRow).join('')}</div>`
    : '<p class="small faint center">No lessons have been written for this topic yet.</p>'}
      </div>

      <div class="card" style="margin-top:1.25rem">
        <div class="card-header">
          <span class="card-title-icon">${icon('target', 17)}</span>
          <h3>Practice questions</h3>
          ${topic.questionCount
    ? `<a class="btn btn-sm btn-primary" href="#/practice?topic=${topic.id}">Start practising</a>` : ''}
        </div>
        ${topic.questionCount
    ? `<p class="muted small">${plural(topic.questionCount, 'question')} in the bank for this topic.</p>
           <div class="chip-row">${difficultyChips}</div>`
    : '<p class="small faint center">No questions have been added for this topic yet.</p>'}
      </div>
    </div>`;

  delegate(mount, 'click', '[data-bookmark]', async (_event, node) => {
    try {
      const result = await api.learn.toggleBookmark('topic', topic.id);
      node.classList.toggle('active', result.bookmarked);
      node.innerHTML = `${icon('bookmark', 16)} ${result.bookmarked ? 'Bookmarked' : 'Bookmark'}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function lessonRow(lesson) {
  const done = lesson.myStatus === 'completed';
  const started = lesson.myStatus === 'opened';
  return `
    <a class="list-item" href="#/lesson/${lesson.id}">
      <span class="lesson-status ${done ? 'done' : ''}">${done ? icon('check', 15) : icon('play', 14)}</span>
      <div class="meta">
        <div class="title">
          ${esc(lesson.title)}
          ${lesson.status === 'published' ? '' : '<span class="badge badge-warning">Draft</span>'}
        </div>
        <div class="sub">${lesson.minutes} min read &middot; ${lesson.xpReward} XP${started ? ' &middot; in progress' : ''}</div>
      </div>
      <span class="faint">${icon('arrowRight', 16)}</span>
    </a>`;
}
