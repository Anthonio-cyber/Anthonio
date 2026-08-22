// ==========================================================
// The badge wall: what you have earned, and what is still ahead.
// ==========================================================
import { esc, formatDate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { progressBar, statTile } from '../components/learn.js';

export default async function achievementsView({ mount }) {
  setPageTitle('Achievements');
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.users.achievements();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    return;
  }

  const { achievements, earned, total, codingStats } = data;
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
        ${statTile({ label: 'Level', value: store.user.level, iconName: 'trophy', tone: 'accent' })}
        ${statTile({ label: 'XP', value: store.user.xp, iconName: 'star', tone: 'accent' })}
        ${statTile({ label: 'Lessons', value: codingStats.lessonsCompleted, iconName: 'book' })}
        ${statTile({ label: 'Questions', value: codingStats.questionsAnswered, iconName: 'target' })}
      </div>

      <div class="badge-grid">
        ${achievements.map((a) => `
          <div class="badge-tile ${a.earned ? 'earned' : 'locked'}">
            <span class="badge-mark">${icon(badgeIcon(a.icon), 22)}</span>
            <strong>${esc(a.name)}</strong>
            <p class="small muted">${esc(a.description)}</p>
            <span class="small faint">${a.earned ? `Earned ${formatDate(a.awarded_at)}` : 'Not yet earned'}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

/** The badge table stores a short icon name; map it onto our icon set. */
function badgeIcon(name) {
  const map = {
    star: 'star', pen: 'edit', trophy: 'trophy', flag: 'flag', book: 'book',
    fire: 'fire', level: 'zap', users: 'users', badge: 'award', award: 'award',
    target: 'target', zap: 'zap'
  };
  return map[name] || 'award';
}
