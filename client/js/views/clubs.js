// ==========================================================
// The club directory and the "create a club" form.
// ==========================================================
import { esc, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState, avatar } from '../components/common.js';
import { toast, modal } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

export default async function clubs({ mount, query }) {
  setPageTitle('Clubs');
  let showMine = query.mine === 'true';
  let search = '';
  let category = '';

  mount.innerHTML = `
    <div class="page page-wide">
      <div class="row" style="margin-bottom:1rem">
        <div>
          <h1 style="margin:0">Clubs</h1>
          <p class="muted small" style="margin:0">Join a club, or start your own.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="create-club">${icon('plus', 16)} Create a club</button>
      </div>

      <div class="card" style="margin-bottom:1.25rem">
        <div class="row">
          <div class="topbar-search" style="max-width:none;flex:1 1 220px">
            ${icon('search', 16)}
            <input class="input" id="club-search" placeholder="Search clubs..." style="padding-left:2.2rem">
          </div>
          <div class="btn-group">
            <button data-scope="all" class="${showMine ? '' : 'active'}">All clubs</button>
            <button data-scope="mine" class="${showMine ? 'active' : ''}">My clubs</button>
          </div>
        </div>
        <div class="row row-tight" id="category-row" style="margin-top:.75rem"></div>
      </div>

      <div id="club-grid"><div class="spinner spinner-center"></div></div>
    </div>`;

  const load = async () => {
    const grid = mount.querySelector('#club-grid');
    grid.innerHTML = '<div class="spinner spinner-center"></div>';
    const parts = [];
    if (showMine) parts.push('mine=true');
    if (search) parts.push(`search=${encodeURIComponent(search)}`);
    if (category) parts.push(`category=${encodeURIComponent(category)}`);

    try {
      const data = await api.clubs.list(parts.length ? `?${parts.join('&')}` : '');
      renderCategories(mount, data.categories, category);
      mount.querySelector('#create-club').hidden = !data.canCreate;

      grid.innerHTML = data.clubs.length
        ? `<div class="grid grid-3">${data.clubs.map(clubCard).join('')}</div>`
        : `<div class="card">${emptyState({
          iconName: 'users',
          title: showMine ? 'You have not joined a club yet' : 'No clubs found',
          text: showMine ? 'Browse all clubs and join one that interests you.' : 'Try a different search, or start a new club.',
          action: showMine ? '<button class="btn btn-primary" data-scope="all">Browse all clubs</button>' : ''
        })}</div>`;

      if (data.creationMode === 'approval') {
        mount.querySelector('#create-club').title = 'New clubs need an administrator to approve them.';
      }
    } catch (err) {
      grid.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  };

  mount.addEventListener('click', async (event) => {
    const scope = event.target.closest('[data-scope]');
    if (scope) {
      showMine = scope.dataset.scope === 'mine';
      for (const button of mount.querySelectorAll('.btn-group [data-scope]')) {
        button.classList.toggle('active', button.dataset.scope === scope.dataset.scope);
      }
      await load();
      return;
    }

    const chip = event.target.closest('[data-category]');
    if (chip) {
      category = chip.dataset.category === category ? '' : chip.dataset.category;
      await load();
      return;
    }

    const join = event.target.closest('[data-join]');
    if (join) {
      const id = Number(join.dataset.join);
      try {
        const result = await api.clubs.join(id);
        toast(result.joined ? 'You joined the club.' : 'Your request has been sent to the club leaders.', 'success');
        await load();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    if (event.target.closest('#create-club')) openCreateClub(load);
  });

  let timer;
  mount.querySelector('#club-search').addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => { search = event.target.value.trim(); load(); }, 250);
  });

  await load();
}

function renderCategories(mount, categories, active) {
  const row = mount.querySelector('#category-row');
  if (!row) return;
  row.innerHTML = categories.map((c) => `
    <button class="chip ${c === active ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`).join('');
}

function clubCard(club) {
  return `
    <article class="card card-hover club-card">
      <div class="club-cover" ${club.coverUrl ? `style="background-image:url('${esc(club.coverUrl)}')"` : ''}></div>
      <div class="club-card-body">
        <span class="club-logo">${club.logoUrl ? `<img src="${esc(club.logoUrl)}" alt="">` : esc(club.name.slice(0, 2).toUpperCase())}</span>
        <h3 style="margin:.5rem 0 .15rem">${esc(club.name)}</h3>
        <div class="tiny faint">@${esc(club.handle)} - ${esc(club.category)}</div>
        <p class="small muted clamp-2" style="margin:.6rem 0">${esc(club.description || 'No description yet.')}</p>
        <div class="row row-tight" style="justify-content:space-between">
          <span class="badge">${icon('users', 12)} ${plural(club.memberCount, 'member')}</span>
          ${club.myRole
    ? `<a class="btn btn-sm" href="#/clubs/${club.id}">Open</a>`
    : (club.pending === 'join'
      ? '<span class="badge badge-warning">Requested</span>'
      : (club.pending === 'invite'
        ? `<button class="btn btn-sm btn-primary" data-join="${club.id}">Accept invite</button>`
        : `<button class="btn btn-sm btn-primary" data-join="${club.id}">Join</button>`))}
        </div>
      </div>
    </article>`;
}

export function openCreateClub(onDone) {
  modal({
    title: 'Create a club',
    size: 'modal-lg',
    body: `
      <form id="club-form">
        <div class="grid grid-2" style="gap:0 1rem">
          <div class="field">
            <label for="club-name">Club name</label>
            <input class="input" id="club-name" name="name" placeholder="Coding Club" maxlength="60" required>
          </div>
          <div class="field">
            <label for="club-handle">Handle</label>
            <input class="input" id="club-handle" name="handle" placeholder="coding-club" maxlength="40">
            <span class="hint">Used in the club address. Leave blank to build it from the name.</span>
          </div>
        </div>
        <div class="field">
          <label for="club-category">Category</label>
          <input class="input" id="club-category" name="category" placeholder="Technology" list="club-categories" maxlength="40">
          <datalist id="club-categories">
            <option>Academic</option><option>Sport</option><option>Creative</option>
            <option>Technology</option><option>Games</option><option>Music</option><option>General</option>
          </datalist>
        </div>
        <div class="field">
          <label for="club-description">What is the club about?</label>
          <textarea class="textarea" id="club-description" name="description" maxlength="600"
                    placeholder="We build small websites and games together every Thursday."></textarea>
        </div>
        <div class="field">
          <label for="club-rules">Club rules (optional)</label>
          <textarea class="textarea" id="club-rules" name="rules" maxlength="800"
                    placeholder="Be kind. Stay on topic. No bullying."></textarea>
        </div>
        <div class="grid grid-2" style="gap:0 1rem">
          <div class="field">
            <label for="club-logo">Logo (optional)</label>
            <input class="input" id="club-logo" name="logo" type="file" accept="image/*">
          </div>
          <div class="field">
            <label for="club-cover">Cover picture (optional)</label>
            <input class="input" id="club-cover" name="cover" type="file" accept="image/*">
          </div>
        </div>
      </form>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" id="club-submit">Create club</button>`,
    onOpen: ({ root, close }) => {
      const form = root.querySelector('#club-form');
      root.querySelector('#club-submit').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (!form.reportValidity()) return;
        button.disabled = true;
        button.textContent = 'Creating...';
        try {
          const data = new FormData(form);
          const result = await api.clubs.create(data);
          close();
          toast(result.status === 'pending'
            ? 'Your club has been sent to an administrator for approval.'
            : 'Your club is live.', 'success');
          if (result.status === 'approved') navigate(`/clubs/${result.club.id}`);
          else onDone?.();
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
          button.textContent = 'Create club';
        }
      });
    }
  });
}
