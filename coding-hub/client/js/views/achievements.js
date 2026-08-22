// ==========================================================
// Coding Hub - the badge wall (specification section 32).
// ==========================================================
import { esc, formatDate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { progressBar, statTile } from '../components/learn.js';

export default async function achievements({ mount }) {
  setPageTitle('Achievements');
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.users.badges();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    return;
  }

  const { badges, earned, total, stats } = data;
  const percent = total ? Math.round((earned / total) * 100) : 0;

  mount.innerHTML = `
    <div class="page page-narrow">
      <header class="page-head">
        <div>
          <h1>Achievements</h1>
          <p class="muted">${earned} of ${total} badges unlocked.</p>
        </div>
        <a class="btn btn-ghost" href="#/progress">${icon('chart', 16)} My progress</a>
      </header>

      <div class="card">${progressBar(percent, `${earned} of ${total} badges`)}</div>

      <div class="grid grid-4" style="margin:1.25rem 0">
        ${statTile({ label: 'Level', value: `${store.user.level} ${store.user.levelTitle || ''}`, iconName: 'trophy', tone: 'accent' })}
        ${statTile({ label: 'XP', value: store.user.xp, iconName: 'star', tone: 'accent' })}
        ${statTile({ label: 'Lessons', value: stats.lessonsCompleted, iconName: 'book' })}
        ${statTile({ label: 'Questions', value: stats.questionsAnswered, iconName: 'target' })}
      </div>

      <div class="badge-grid">
        ${badges.map((b) => `
          <div class="badge-tile ${b.earned ? 'earned' : 'locked'}">
            <span class="badge-mark">${icon(b.icon || 'award', 22)}</span>
            <strong>${esc(b.name)}</strong>
            <p class="small muted">${esc(b.description)}</p>
            <span class="small faint">${b.earned ? `Earned ${formatDate(b.awarded_at)}` : 'Not yet earned'}</span>
          </div>`).join('')}
      </div>
    </div>`;
}
