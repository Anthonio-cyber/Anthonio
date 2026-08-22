// ==========================================================
// Coding Hub - global search (specification section 52):
// subjects, topics, lessons, questions and members.
// ==========================================================
import { esc, debounce } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';
import { difficultyBadge } from '../components/learn.js';

export default async function search({ mount, query }) {
  setPageTitle('Search');
  let term = query.q || '';

  mount.innerHTML = `
    <div class="page page-narrow">
      <header class="page-head">
        <div>
          <h1>Search</h1>
          <p class="muted">Look through every subject, topic, lesson, question and member.</p>
        </div>
      </header>
      <div class="field">
        <input class="input" id="q" placeholder="What are you looking for?" value="${esc(term)}" autocomplete="off">
      </div>
      <div id="results"></div>
    </div>`;

  const input = mount.querySelector('#q');
  const results = mount.querySelector('#results');
  input.focus();

  async function run() {
    if (term.trim().length < 2) {
      results.innerHTML = `<p class="small faint center">Type at least two letters.</p>`;
      return;
    }
    results.innerHTML = '<div class="spinner spinner-center"></div>';
    try {
      const [content, people] = await Promise.all([
        api.learn.search(term),
        api.users.list(`?search=${encodeURIComponent(term)}`)
      ]);

      const groups = [
        {
          label: 'Subjects', iconName: 'book', items: content.subjects,
          render: (s) => `<a class="list-item" href="#/subject/${esc(s.slug)}">
            <div class="meta"><div class="title">${esc(s.name)}</div>
            <div class="sub">${s.topicCount} topics &middot; ${s.lessonCount} lessons</div></div></a>`
        },
        {
          label: 'Topics', iconName: 'grid', items: content.topics,
          render: (t) => `<a class="list-item" href="#/topic/${t.id}">
            <div class="meta"><div class="title">${esc(t.name)}</div>
            <div class="sub">${esc(t.subjectName)} &middot; ${t.questionCount} questions</div></div></a>`
        },
        {
          label: 'Lessons', iconName: 'play', items: content.lessons,
          render: (l) => `<a class="list-item" href="#/lesson/${l.id}">
            <div class="meta"><div class="title">${esc(l.title)}</div>
            <div class="sub">${esc(l.subjectName)} &middot; ${esc(l.topicName)}</div></div>
            ${l.myStatus === 'completed' ? '<span class="badge badge-success">Done</span>' : ''}</a>`
        },
        {
          label: 'Questions', iconName: 'target', items: content.questions,
          render: (q) => `<div class="list-item">
            <div class="meta"><div class="title" style="white-space:normal">${esc(q.prompt.slice(0, 110))}</div>
            <div class="sub">${esc(q.subjectName)} &middot; ${esc(q.topicName)}</div></div>
            ${difficultyBadge(q.difficulty)}</div>`
        },
        {
          label: 'Members', iconName: 'users', items: people.users,
          render: (u) => `<a class="list-item" href="#/profile/${esc(u.username)}">
            ${avatar(u, 'sm', true)}
            <div class="meta"><div class="title">${esc(u.displayName)}</div>
            <div class="sub">@${esc(u.username)} &middot; Level ${u.level}</div></div></a>`
        }
      ].filter((g) => g.items?.length);

      results.innerHTML = groups.length
        ? groups.map((g) => `
          <div class="card" style="margin-bottom:1rem">
            <div class="card-header">
              <span class="card-title-icon">${icon(g.iconName, 17)}</span>
              <h3>${esc(g.label)}</h3>
              <span class="badge">${g.items.length}</span>
            </div>
            <div class="list">${g.items.map(g.render).join('')}</div>
          </div>`).join('')
        : emptyState({ iconName: 'search', title: 'Nothing found', text: `No results for "${term}".` });
    } catch (err) {
      results.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  input.addEventListener('input', debounce((event) => {
    term = event.target.value;
    run();
  }, 300));

  await run();
}
