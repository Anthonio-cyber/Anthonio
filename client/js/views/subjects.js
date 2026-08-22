// ==========================================================
// Coding Hub - the subject list, and one subject's topics.
// Handles both #/subjects and #/subject/:key.
// ==========================================================
import { esc, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { toast } from '../lib/ui.js';
import { subjectCard, progressBar, statTile } from '../components/learn.js';

export default async function subjectsView({ mount, params }) {
  return params.key ? renderSubject(mount, params.key) : renderList(mount);
}

// ---------------------------------------------------------------------------
// #/subjects
// ---------------------------------------------------------------------------
async function renderList(mount) {
  setPageTitle('Coding Hub');
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.learn.subjects();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    return;
  }

  const { subjects, stats } = data;

  mount.innerHTML = `
    <div class="page page-wide">
      <header class="page-head">
        <div>
          <h1>Subjects</h1>
          <p class="muted">Pick a subject, work through the lessons, then practise with the questions.</p>
        </div>
        <div class="row">
          <a class="btn btn-ghost" href="#/practice">${icon('target', 16)} Practice</a>
          <a class="btn btn-ghost" href="#/progress">${icon('chart', 16)} My progress</a>
        </div>
      </header>

      <div class="grid grid-4" style="margin-bottom:1.25rem">
        ${statTile({ label: 'Lessons completed', value: `${stats.lessonsCompleted}/${stats.lessonsAvailable}`, iconName: 'book' })}
        ${statTile({ label: 'Questions answered', value: stats.questionsAnswered, iconName: 'target' })}
        ${statTile({ label: 'Accuracy', value: `${stats.accuracy}%`, iconName: 'chart', tone: stats.accuracy >= 70 ? 'success' : '' })}
        ${statTile({ label: 'Challenges done', value: stats.challengesCompleted, iconName: 'zap' })}
      </div>

      ${subjects.length
    ? `<div class="subject-grid">${subjects.map(subjectCard).join('')}</div>`
    : emptyState({
      iconName: 'book',
      title: 'No subjects yet',
      text: can('subjects.create')
        ? 'Create the first subject in the admin dashboard.'
        : 'An administrator has not added any subjects yet.',
      action: can('subjects.create') ? '<a class="btn btn-primary" href="#/admin/subjects">Manage subjects</a>' : ''
    })}
    </div>`;
}

// ---------------------------------------------------------------------------
// #/subject/:key
// ---------------------------------------------------------------------------
async function renderSubject(mount, key) {
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.learn.subject(key);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'search', title: 'Subject not found', text: err.message,
      action: '<a class="btn btn-primary" href="#/subjects">Back to subjects</a>'
    })}</div>`;
    return;
  }

  const { subject, topics } = data;
  setPageTitle(subject.name);

  mount.innerHTML = `
    <div class="page page-wide">
      <a class="back-link" href="#/subjects">${icon('arrowLeft', 15)} All subjects</a>

      <header class="subject-hero" data-colour="${esc(subject.colour)}">
        <span class="subject-mark subject-mark-lg">${icon(subject.icon || 'code', 28)}</span>
        <div>
          <h1>${esc(subject.name)}${subject.published ? '' : ' <span class="badge badge-warning">Draft</span>'}</h1>
          <p class="muted">${esc(subject.description)}</p>
          <div class="small faint">${subject.topicCount} topics &middot; ${subject.lessonCount} lessons &middot; ${subject.questionCount} questions</div>
          ${progressBar(subject.percentComplete, `${subject.lessonsCompleted} of ${subject.lessonCount} lessons completed`)}
        </div>
        <div class="row">
          <a class="btn btn-primary" href="#/practice?subject=${esc(subject.slug)}">${icon('target', 16)} Practise this subject</a>
        </div>
      </header>

      ${topics.length
    ? `<div class="topic-list">${topics.map(topicRow).join('')}</div>`
    : emptyState({ iconName: 'book', title: 'No topics yet', text: 'This subject has no topics to study yet.' })}
    </div>`;

  delegate(mount, 'click', '[data-bookmark-topic]', async (event, node) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const result = await api.learn.toggleBookmark('topic', Number(node.dataset.bookmarkTopic));
      node.classList.toggle('active', result.bookmarked);
      toast(result.bookmarked ? 'Topic bookmarked.' : 'Bookmark removed.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function topicRow(topic) {
  const done = topic.lessonCount > 0 && topic.lessonsCompleted >= topic.lessonCount;
  return `
    <a class="topic-row card-hover ${done ? 'is-done' : ''}" href="#/topic/${topic.id}">
      <span class="topic-status">${done ? icon('check', 16) : `<span class="topic-number">${topic.position + 1}</span>`}</span>
      <div class="topic-body">
        <div class="topic-title">
          ${esc(topic.name)}
          ${topic.published ? '' : '<span class="badge badge-warning">Hidden</span>'}
        </div>
        <div class="small faint">
          ${topic.lessonCount} ${topic.lessonCount === 1 ? 'lesson' : 'lessons'} &middot;
          ${topic.questionCount} ${topic.questionCount === 1 ? 'question' : 'questions'}
          ${topic.lessonsCompleted ? ` &middot; ${topic.lessonsCompleted} completed` : ''}
        </div>
      </div>
      <button type="button" class="icon-button ${topic.bookmarked ? 'active' : ''}" data-bookmark-topic="${topic.id}" title="Bookmark this topic">
        ${icon('bookmark', 16)}
      </button>
      <span class="topic-chevron">${icon('arrowRight', 16)}</span>
    </a>`;
}
