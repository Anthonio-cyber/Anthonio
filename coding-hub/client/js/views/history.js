// ==========================================================
// Coding Hub - the learner's own history: lessons opened and
// completed, challenges finished, and every question answered.
// ==========================================================
import { esc, timeAgo, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { difficultyBadge, statTile } from '../components/learn.js';

export default async function historyView({ mount }) {
  setPageTitle('Learning history');
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let offset = 0;
  let data;
  try {
    data = await api.learn.history('?limit=40');
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    return;
  }

  const { stats, activity, attempts, total } = data;
  const loaded = [...attempts];

  render();

  function render() {
    mount.innerHTML = `
      <div class="page page-wide">
        <header class="page-head">
          <div>
            <h1>Learning history</h1>
            <p class="muted">Everything you have opened, completed and answered.</p>
          </div>
          <a class="btn btn-ghost" href="#/progress">${icon('chart', 16)} My progress</a>
        </header>

        <div class="grid grid-4" style="margin-bottom:1.25rem">
          ${statTile({ label: 'Lessons completed', value: stats.lessonsCompleted, iconName: 'book' })}
          ${statTile({ label: 'Questions answered', value: stats.questionsAnswered, iconName: 'target' })}
          ${statTile({ label: 'Accuracy', value: `${stats.accuracy}%`, iconName: 'chart' })}
          ${statTile({ label: 'Challenges', value: stats.challengesCompleted, iconName: 'zap' })}
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-header">
              <span class="card-title-icon">${icon('clock', 17)}</span>
              <h3>Lessons and challenges</h3>
            </div>
            ${activity.length ? `
              <div class="list">
                ${activity.map((a) => `
                  <a class="list-item" href="${esc(a.link)}">
                    <span class="lesson-status ${a.kind === 'lesson_opened' ? '' : 'done'}">
                      ${icon(a.kind === 'challenge_completed' ? 'zap' : (a.kind === 'lesson_completed' ? 'check' : 'play'), 14)}
                    </span>
                    <div class="meta">
                      <div class="title">${esc(a.title)}</div>
                      <div class="sub">${esc(a.subtitle)} &middot; ${timeAgo(a.at)}</div>
                    </div>
                  </a>`).join('')}
              </div>`
    : '<p class="small faint center">Open a lesson and it will appear here.</p>'}
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title-icon">${icon('target', 17)}</span>
              <h3>Answered questions</h3>
              <span class="badge">${total}</span>
            </div>
            ${loaded.length ? `
              <div class="list" id="attempt-list">
                ${loaded.map(attemptRow).join('')}
              </div>
              ${loaded.length < total
    ? '<div class="center" style="margin-top:.8rem"><button type="button" class="btn btn-ghost btn-sm" data-more>Load more</button></div>'
    : ''}`
    : emptyState({ iconName: 'target', title: 'Nothing answered yet', text: 'Head to Practice to get started.', action: '<a class="btn btn-primary" href="#/practice">Practise now</a>' })}
          </div>
        </div>
      </div>`;

    delegate(mount, 'click', '[data-more]', async (_event, node) => {
      offset += 40;
      node.disabled = true;
      try {
        const more = await api.learn.history(`?limit=40&offset=${offset}`);
        loaded.push(...more.attempts);
        render();
      } catch {
        node.disabled = false;
      }
    });
  }

  function attemptRow(attempt) {
    return `
      <div class="list-item">
        <span class="attempt-mark ${attempt.correct ? 'correct' : 'wrong'}">
          ${icon(attempt.correct ? 'check' : 'close', 13)}
        </span>
        <div class="meta">
          <div class="title" style="white-space:normal">${esc(attempt.prompt.slice(0, 110))}${attempt.prompt.length > 110 ? '...' : ''}</div>
          <div class="sub">
            ${esc(attempt.subjectName)} &middot; ${esc(attempt.topicName)} &middot; ${timeAgo(attempt.createdAt)}
            ${attempt.pointsAwarded ? ` &middot; +${attempt.pointsAwarded} XP` : ''}
          </div>
        </div>
        ${difficultyBadge(attempt.difficulty)}
      </div>`;
  }
}
