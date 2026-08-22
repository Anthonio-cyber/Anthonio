// ==========================================================
// Coding Hub - the member directory (spec section 15: find a
// user, open their profile, start a conversation).
// ==========================================================
import { esc, debounce, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';
import { toast } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

export default async function members({ mount }) {
  setPageTitle('Members');
  let term = '';

  mount.innerHTML = `
    <div class="page page-narrow">
      <header class="page-head">
        <div>
          <h1>Members</h1>
          <p class="muted">Find somebody, look at their progress, or start a conversation.</p>
        </div>
        <a class="btn btn-ghost" href="#/leaderboard">${icon('trophy', 16)} Leaderboard</a>
      </header>

      <div class="field">
        <input class="input" id="member-search" placeholder="Search by name or username..." autocomplete="off">
      </div>

      <div id="member-list"><div class="spinner spinner-center"></div></div>
    </div>`;

  const list = mount.querySelector('#member-list');

  async function load() {
    try {
      const { users } = await api.users.list(term ? `?search=${encodeURIComponent(term)}` : '');
      list.innerHTML = users.length
        ? `<div class="card"><div class="list">${users.map(row).join('')}</div></div>`
        : emptyState({ iconName: 'search', title: 'Nobody found', text: 'Try a different name.' });
    } catch (err) {
      list.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  function row(user) {
    const isSelf = user.id === store.user.id;
    return `
      <div class="list-item">
        <a href="#/profile/${esc(user.username)}" style="display:flex;gap:.7rem;align-items:center;flex:1;min-width:0;color:inherit">
          ${avatar(user, 'sm', true)}
          <div class="meta">
            <div class="title">${esc(user.displayName)}${user.verified ? ` ${icon('check', 12)}` : ''}</div>
            <div class="sub">@${esc(user.username)} &middot; Level ${user.level} ${esc(user.levelTitle || '')} &middot; ${user.xp} XP</div>
          </div>
        </a>
        ${isSelf ? '<span class="badge">You</span>'
    : `<button type="button" class="btn btn-sm" data-message="${user.id}">${icon('message', 14)} Message</button>`}
      </div>`;
  }

  mount.querySelector('#member-search').addEventListener('input', debounce((event) => {
    term = event.target.value.trim();
    load();
  }, 250));

  delegate(mount, 'click', '[data-message]', async (_event, node) => {
    try {
      const { conversation } = await api.messages.openWith(Number(node.dataset.message));
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  await load();
}
