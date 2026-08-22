// ==========================================================
// Coding Hub - every coding challenge in one place.
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { difficultyBadge, statTile } from '../components/learn.js';

export default async function challenges({ mount }) {
  setPageTitle('Coding challenges');
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  let list = [];
  try {
    list = (await api.learn.challenges()).challenges;
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    return;
  }

  const done = list.filter((c) => c.completed).length;
  const bySubject = new Map();
  for (const challenge of list) {
    if (!bySubject.has(challenge.subjectName)) bySubject.set(challenge.subjectName, []);
    bySubject.get(challenge.subjectName).push(challenge);
  }

  mount.innerHTML = `
    <div class="page page-narrow">
      <header class="page-head">
        <div>
          <h1>Coding challenges</h1>
          <p class="muted">Build something small with what each lesson taught you.</p>
        </div>
        <a class="btn btn-ghost" href="#/subjects">${icon('book', 16)} Subjects</a>
      </header>

      <div class="grid grid-3" style="margin-bottom:1.25rem">
        ${statTile({ label: 'Challenges', value: list.length, iconName: 'zap' })}
        ${statTile({ label: 'Completed', value: done, iconName: 'check', tone: 'success' })}
        ${statTile({ label: 'Left to do', value: list.length - done, iconName: 'target' })}
      </div>

      ${list.length ? [...bySubject.entries()].map(([subject, items]) => `
        <div class="card" style="margin-bottom:1rem">
          <div class="card-header">
            <span class="card-title-icon">${icon('code', 17)}</span>
            <h3>${esc(subject)}</h3>
            <span class="badge">${items.filter((c) => c.completed).length}/${items.length}</span>
          </div>
          <div class="list">
            ${items.map((c) => `
              <a class="list-item" href="#/lesson/${c.lessonId}">
                <span class="lesson-status ${c.completed ? 'done' : ''}">${icon(c.completed ? 'check' : 'zap', 14)}</span>
                <div class="meta">
                  <div class="title">${esc(c.title)}</div>
                  <div class="sub">${esc(c.topicName)} &middot; ${esc(c.lessonTitle)}</div>
                </div>
                ${difficultyBadge(c.difficulty)}
                <span class="badge badge-accent">${c.points} XP</span>
              </a>`).join('')}
          </div>
        </div>`).join('')
    : emptyState({ iconName: 'zap', title: 'No challenges yet', text: 'Challenges live inside lessons. An administrator can add them from the lesson editor.' })}
    </div>`;
}
