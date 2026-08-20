// ==========================================================
// The leaderboard, with four categories.
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';

const CATEGORIES = [
  ['overall', 'Overall', 'trophy'],
  ['games', 'Games', 'game'],
  ['learning', 'Learning', 'book'],
  ['weekly', 'This week', 'fire']
];

export default async function leaderboard({ mount, query }) {
  setPageTitle('Leaderboard');
  let category = CATEGORIES.some(([key]) => key === query.category) ? query.category : 'overall';

  mount.innerHTML = `
    <div class="page page-narrow">
      <div style="margin-bottom:1rem">
        <h1 style="margin:0">Leaderboard</h1>
        <p class="muted small" style="margin:0">XP from games and learning activities. It has nothing to do with your school grades.</p>
      </div>

      <div class="btn-group" style="margin-bottom:1.25rem" id="lb-tabs">
        ${CATEGORIES.map(([key, label, iconName]) => `
          <button data-category="${key}" class="${key === category ? 'active' : ''}">${icon(iconName, 14)} ${esc(label)}</button>`).join('')}
      </div>

      <div id="lb-content"><div class="spinner spinner-center"></div></div>
    </div>`;

  async function load() {
    const content = mount.querySelector('#lb-content');
    content.innerHTML = '<div class="spinner spinner-center"></div>';
    try {
      const data = await api.games.leaderboard(category);

      if (!data.enabled) {
        content.innerHTML = `<div class="card">${emptyState({
          iconName: 'lock',
          title: 'Leaderboards are switched off',
          text: 'An administrator has hidden the leaderboard for now.'
        })}</div>`;
        return;
      }

      if (!data.entries.length) {
        content.innerHTML = `<div class="card">${emptyState({
          iconName: 'trophy', title: 'No scores yet', text: 'Play a game in the Gaming Hub to get on the board.',
          action: '<a class="btn btn-primary" href="#/games">Open the Gaming Hub</a>'
        })}</div>`;
        return;
      }

      const podium = data.entries.slice(0, 3);
      const rest = data.entries.slice(3);
      const unit = category === 'learning' ? 'points' : 'XP';

      content.innerHTML = `
        ${podium.length === 3 ? `
          <div class="podium">
            ${[podium[1], podium[0], podium[2]].map((entry, i) => {
    const place = [2, 1, 3][i];
    return `
                <a class="podium-slot place-${place}" href="#/profile/${esc(entry.user.username)}">
                  <span class="podium-rank">${place}</span>
                  ${avatar(entry.user, place === 1 ? 'lg' : 'md', true)}
                  <span class="bold small truncate">${esc(entry.user.displayName)}</span>
                  <span class="tiny faint">${entry.value} ${unit}</span>
                  <span class="podium-bar"></span>
                </a>`;
  }).join('')}
          </div>` : ''}

        <div class="card card-flush">
          <table>
            <thead>
              <tr><th style="width:56px">#</th><th>Member</th><th>Level</th><th style="text-align:right">${esc(unit)}</th></tr>
            </thead>
            <tbody>
              ${(podium.length === 3 ? rest : data.entries).map((entry) => `
                <tr class="${entry.user.id === store.user.id ? 'me-row' : ''}">
                  <td><span class="rank rank-${entry.rank}">${entry.rank}</span></td>
                  <td>
                    <a href="#/profile/${esc(entry.user.username)}" style="display:flex;align-items:center;gap:.6rem;color:inherit">
                      ${avatar(entry.user, 'xs', true)}
                      <span class="truncate">${esc(entry.user.displayName)}${entry.user.id === store.user.id ? ' (you)' : ''}</span>
                    </a>
                  </td>
                  <td><span class="badge">Lv ${entry.user.level}</span></td>
                  <td style="text-align:right" class="bold">${entry.value}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        ${data.myRank ? `<p class="center small muted" style="margin-top:1rem">You are number ${data.myRank} on this board.</p>` : ''}`;
    } catch (err) {
      content.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  mount.querySelector('#lb-tabs').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    for (const b of mount.querySelectorAll('[data-category]')) b.classList.toggle('active', b === button);
    await load();
  });

  await load();
}
