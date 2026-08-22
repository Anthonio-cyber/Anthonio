// ==========================================================
// Coding Hub - everything the learner saved for later.
// ==========================================================
import { esc, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { toast } from '../lib/ui.js';
import { difficultyBadge, TYPE_LABELS } from '../components/learn.js';

const GROUPS = [
  { kind: 'lesson', label: 'Lessons', iconName: 'book' },
  { kind: 'topic', label: 'Topics', iconName: 'grid' },
  { kind: 'challenge', label: 'Coding challenges', iconName: 'zap' },
  { kind: 'question', label: 'Questions', iconName: 'target' }
];

export default async function bookmarksView({ mount }) {
  setPageTitle('Bookmarks');
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  let bookmarks = [];
  try {
    bookmarks = (await api.learn.bookmarks()).bookmarks;
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    return;
  }

  render();

  function render() {
    const groups = GROUPS
      .map((group) => ({ ...group, items: bookmarks.filter((b) => b.kind === group.kind) }))
      .filter((group) => group.items.length);

    mount.innerHTML = `
      <div class="page page-narrow">
        <header class="page-head">
          <div>
            <h1>Bookmarks</h1>
            <p class="muted">Lessons, topics, challenges and questions you saved to come back to.</p>
          </div>
          <a class="btn btn-ghost" href="#/subjects">${icon('book', 16)} Subjects</a>
        </header>

        ${groups.length ? groups.map(renderGroup).join('') : emptyState({
    iconName: 'bookmark',
    title: 'Nothing saved yet',
    text: 'Use the bookmark button on any lesson, topic or question to save it here.',
    action: '<a class="btn btn-primary" href="#/subjects">Browse subjects</a>'
  })}
      </div>`;

    delegate(mount, 'click', '[data-remove]', async (event, node) => {
      event.preventDefault();
      event.stopPropagation();
      const kind = node.dataset.kind;
      const id = Number(node.dataset.remove);
      try {
        await api.learn.toggleBookmark(kind, id);
        bookmarks = bookmarks.filter((b) => !(b.kind === kind && b.item.id === id));
        toast('Bookmark removed.', 'success');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  function renderGroup(group) {
    return `
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-header">
          <span class="card-title-icon">${icon(group.iconName, 17)}</span>
          <h3>${esc(group.label)}</h3>
          <span class="badge">${group.items.length}</span>
        </div>
        <div class="list">${group.items.map((b) => renderItem(group.kind, b)).join('')}</div>
      </div>`;
  }

  function renderItem(kind, bookmark) {
    const item = bookmark.item;
    const remove = `
      <button type="button" class="icon-button" data-remove="${item.id}" data-kind="${kind}" title="Remove bookmark">
        ${icon('close', 15)}
      </button>`;

    if (kind === 'lesson') {
      return `
        <a class="list-item" href="#/lesson/${item.id}">
          <div class="meta">
            <div class="title">${esc(item.title)}</div>
            <div class="sub">${esc(item.subjectName)} &middot; ${esc(item.topicName)} &middot; ${item.minutes} min</div>
          </div>
          ${item.myStatus === 'completed' ? '<span class="badge badge-success">Done</span>' : ''}
          ${remove}
        </a>`;
    }
    if (kind === 'topic') {
      return `
        <a class="list-item" href="#/topic/${item.id}">
          <div class="meta">
            <div class="title">${esc(item.name)}</div>
            <div class="sub">${esc(item.subjectName)} &middot; ${item.lessonCount} lessons &middot; ${item.questionCount} questions</div>
          </div>
          ${remove}
        </a>`;
    }
    if (kind === 'challenge') {
      return `
        <a class="list-item" href="#/lesson/${item.lessonId}">
          <div class="meta">
            <div class="title">${esc(item.title)}</div>
            <div class="sub">${item.points} XP ${item.completed ? '&middot; completed' : ''}</div>
          </div>
          ${difficultyBadge(item.difficulty)}
          ${remove}
        </a>`;
    }
    return `
      <div class="list-item">
        <div class="meta">
          <div class="title" style="white-space:normal">${esc(item.prompt.slice(0, 120))}</div>
          <div class="sub">${esc(item.subjectName)} &middot; ${esc(item.topicName)} &middot; ${esc(TYPE_LABELS[item.type] || item.type)}</div>
        </div>
        ${difficultyBadge(item.difficulty)}
        ${remove}
      </div>`;
  }
}
