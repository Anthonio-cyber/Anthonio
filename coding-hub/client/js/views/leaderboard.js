// ==========================================================
// Coding Hub - leaderboards (specification section 33).
// ==========================================================
import { esc, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';

const BOARDS = [
  { key: 'xp', label: 'XP', iconName: 'star', unit: 'XP' },
  { key: 'questions', label: 'Questions answered', iconName: 'target', unit: 'answered' },
  { key: 'accuracy', label: 'Accuracy', iconName: 'chart', unit: '%' },
  { key: 'lessons', label: 'Lessons completed', iconName: 'book', unit: 'lessons' },
  { key: 'weekly', label: 'This week', iconName: 'fire', unit: 'points' }
];

export default async function leaderboard({ mount, query }) {
  setPageTitle('Leaderboard');
  let category = BOARDS.some((b) => b.key === query.board) ? query.board : 'xp';

  mount.innerHTML = `
    <div class="page page-narrow">
      <header class="page-head">
        <div>
          <h1>Leaderboard</h1>
          <p class="muted">How everybody is getting on. Nothing here affects your learning.</p>
        </div>
      </header>
      <div class="admin-tabs" id="boards">
        ${BOARDS.map((b) => `
          <button type="button" class="chip ${b.key === category ? 'active' : ''}" data-board="${b.key}">
            ${icon(b.iconName, 14)} ${esc(b.label)}
          </button>`).join('')}
      </div>
      <div id="board" style="margin-top:1.25rem"><div class="spinner spinner-center"></div></div>
    </div>`;

  const panel = mount.querySelector('#board');

  async function load() {
    panel.innerHTML = '<div class="spinner spinner-center"></div>';
    try {
      const data = await api.users.leaderboard(category);
      if (!data.enabled) {
        panel.innerHTML = emptyState({
          iconName: 'trophy', title: 'Leaderboards are switched off',
          text: 'An administrator has turned them off for now.'
        });
        return;
      }
      const board = BOARDS.find((b) => b.key === category);
      panel.innerHTML = data.entries.length
        ? `<div class="card"><div class="list">
            ${data.entries.map((e) => `
              <a class="list-item ${e.user?.id === store.user.id ? 'is-me' : ''}" href="#/profile/${esc(e.user?.username || '')}">
                <span class="rank rank-${e.rank <= 3 ? e.rank : 'n'}">${e.rank}</span>
                ${avatar(e.user, 'sm', true)}
                <div class="meta">
                  <div class="title">${esc(e.user?.displayName || 'Unknown')}</div>
                  <div class="sub">Level ${e.user?.level || 1} ${esc(e.user?.levelTitle || '')}</div>
                </div>
                <span class="badge badge-accent">${e.score} ${esc(board.unit)}</span>
              </a>`).join('')}
          </div></div>`
        : emptyState({ iconName: 'trophy', title: 'Nothing to show yet', text: 'Answer some questions and this fills up.' });
    } catch (err) {
      panel.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  delegate(mount, 'click', '[data-board]', (_event, node) => {
    category = node.dataset.board;
    for (const chip of mount.querySelectorAll('[data-board]')) chip.classList.toggle('active', chip === node);
    load();
  });

  await load();
}
