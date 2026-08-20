// ==========================================================
// Member profiles - your own or a classmate's.
// ==========================================================
import { esc, timeAgo, formatDate, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, roleBadge, openReportDialog } from '../components/common.js';
import { renderPostCard, wirePostList } from '../components/post-card.js';
import { toast, modal, confirmDialog } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

export default async function profile({ mount, params }) {
  const username = params.username || store.user.username;
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.users.profile(username);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({ iconName: 'user', title: 'Member not found', text: err.message })}</div>`;
    return;
  }

  const u = data.user;
  setPageTitle(data.isSelf ? 'My Profile' : u.displayName);

  mount.innerHTML = `
    <div class="page page-wide">
      <section class="profile-hero">
        <div class="profile-cover" ${u.coverUrl ? `style="background-image:url('${esc(u.coverUrl)}')"` : ''}>
          ${data.isSelf ? `<label class="cover-edit">${icon('image', 15)} Change cover
            <input type="file" accept="image/*" hidden id="cover-input"></label>` : ''}
        </div>
        <div class="profile-body">
          <div class="profile-avatar">
            ${avatar(u, 'xl', true)}
            ${data.isSelf ? `<label class="avatar-edit" title="Change your picture">${icon('image', 14)}
              <input type="file" accept="image/*" hidden id="avatar-input"></label>` : ''}
          </div>

          <div class="profile-identity">
            <div class="row row-tight">
              <h1 style="margin:0">${esc(u.displayName)}</h1>
              ${roleBadge(u)}
              ${u.online ? '<span class="badge badge-success">Online</span>' : ''}
            </div>
            <div class="tiny faint">@${esc(u.username)} - ${esc(u.classSection)} - joined ${formatDate(u.joinedAt)}</div>
            ${u.bio ? `<p class="small" style="margin:.6rem 0 0;max-width:60ch">${esc(u.bio)}</p>` : ''}
            ${u.favouriteSubject ? `<div class="tiny faint" style="margin-top:.3rem">Favourite subject: ${esc(u.favouriteSubject)}</div>` : ''}
          </div>

          <div class="profile-actions">
            ${data.isSelf
    ? `<button class="btn btn-primary" id="edit-profile">${icon('edit', 15)} Edit profile</button>`
    : `<button class="btn btn-primary" id="message-user">${icon('message', 15)} Message</button>
               <button class="btn" id="connect-user">${connectLabel(data.connection)}</button>
               <button class="btn btn-ghost" id="report-user" aria-label="Report">${icon('flag', 16)}</button>`}
          </div>
        </div>
      </section>

      <section class="grid grid-4" style="margin:1.25rem 0">
        <div class="stat">
          <div class="stat-icon">${icon('zap', 19)}</div>
          <div class="stat-body">
            <div class="stat-value">${u.level}</div>
            <div class="stat-label">Level - ${u.xp} XP</div>
          </div>
        </div>
        <div class="stat">
          <div class="stat-icon" style="background:var(--info-soft);color:var(--info)">${icon('feed', 19)}</div>
          <div class="stat-body"><div class="stat-value">${data.stats.posts}</div><div class="stat-label">Posts</div></div>
        </div>
        <div class="stat">
          <div class="stat-icon" style="background:var(--success-soft);color:var(--success)">${icon('trophy', 19)}</div>
          <div class="stat-body"><div class="stat-value">${data.stats.wins}</div><div class="stat-label">Game wins</div></div>
        </div>
        <div class="stat">
          <div class="stat-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('fire', 19)}</div>
          <div class="stat-body"><div class="stat-value">${u.streakDays}</div><div class="stat-label">Day streak</div></div>
        </div>
      </section>

      <div class="card" style="margin-bottom:1.25rem">
        <div class="row row-tight" style="justify-content:space-between">
          <span class="bold">Level ${u.level}</span>
          <span class="tiny faint">${u.xpIntoLevel} / ${u.xpForNextLevel} XP to level ${u.level + 1}</span>
        </div>
        <div class="level-bar" style="height:10px;margin-top:.4rem"><span style="width:${u.levelProgress}%"></span></div>
      </div>

      <div class="with-rail">
        <div>
          <div class="section-title">${icon('feed', 14)} Posts</div>
          <div id="profile-posts"><div class="spinner spinner-center"></div></div>
        </div>
        <aside class="rail">
          ${gameStatsCard(data.stats)}
          ${clubsCard(data.clubs)}
          ${achievementsCard(data.achievements)}
        </aside>
      </div>
    </div>`;

  loadPosts(mount, u.username);
  wirePostList(mount, { onChange: () => loadPosts(mount, u.username) });
  wireProfile(mount, data);
}

function connectLabel(connection) {
  if (!connection) return `${icon('plus', 15)} Connect`;
  if (connection.status === 'accepted') return `${icon('check', 15)} Connected`;
  return connection.incoming ? `${icon('check', 15)} Accept request` : `${icon('clock', 15)} Requested`;
}

function gameStatsCard(stats) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title-icon">${icon('game', 17)}</span>
        <h3>Game statistics</h3>
      </div>
      <div class="grid grid-2" style="gap:.6rem">
        <div class="mini-stat"><span class="bold">${stats.played}</span><span class="tiny faint">Played</span></div>
        <div class="mini-stat"><span class="bold" style="color:var(--success)">${stats.wins}</span><span class="tiny faint">Wins</span></div>
        <div class="mini-stat"><span class="bold" style="color:var(--danger)">${stats.losses}</span><span class="tiny faint">Losses</span></div>
        <div class="mini-stat"><span class="bold">${stats.draws}</span><span class="tiny faint">Draws</span></div>
      </div>
      ${stats.best?.length ? `
        <div class="divider"></div>
        <div class="list">
          ${stats.best.map((b) => `
            <div class="list-item" style="padding:.4rem .25rem">
              <div class="meta"><div class="title">${esc(b.name)}</div><div class="sub">${esc(b.score_label)}</div></div>
              <span class="badge badge-accent">${b.best}</span>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
}

function clubsCard(clubs) {
  return `
    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('users', 17)}</span><h3>Clubs</h3></div>
      ${clubs.length ? `
        <div class="list">
          ${clubs.map((c) => `
            <a class="list-item" href="#/clubs/${c.id}">
              <span class="club-logo club-logo-sm">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : esc(c.name.slice(0, 2).toUpperCase())}</span>
              <div class="meta"><div class="title">${esc(c.name)}</div><div class="sub">${esc(c.role)}</div></div>
            </a>`).join('')}
        </div>` : '<p class="small faint center">No clubs yet.</p>'}
    </div>`;
}

function achievementsCard(achievements) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('award', 17)}</span>
        <h3>Badges</h3>
        <span class="badge">${achievements.length}</span>
      </div>
      ${achievements.length ? `
        <div class="badge-grid">
          ${achievements.map((a) => `
            <div class="badge-tile" title="${esc(a.description)} - earned ${timeAgo(a.awarded_at)}">
              <span class="badge-tile-icon">${icon(badgeIcon(a.icon), 18)}</span>
              <span class="tiny bold truncate">${esc(a.name)}</span>
            </div>`).join('')}
        </div>` : '<p class="small faint center">No badges yet. Play games, post and finish homework to earn them.</p>'}
    </div>`;
}

const badgeIcon = (name) => ({
  star: 'star', pen: 'edit', trophy: 'trophy', flag: 'flag',
  book: 'book', fire: 'fire', level: 'zap', users: 'users'
}[name] || 'award');

async function loadPosts(mount, username) {
  const holder = mount.querySelector('#profile-posts');
  if (!holder) return;
  try {
    const { posts } = await api.users.posts(username);
    holder.innerHTML = posts.length
      ? `<div class="col" style="gap:1rem">${posts.map(renderPostCard).join('')}</div>`
      : `<div class="card">${emptyState({ iconName: 'feed', title: 'No posts yet' })}</div>`;
  } catch (err) {
    holder.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }
}

function wireProfile(mount, data) {
  const u = data.user;

  mount.querySelector('#avatar-input')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      const result = await api.users.uploadAvatar(form);
      store.user.avatarUrl = result.avatarUrl;
      toast('Profile picture updated.', 'success');
      location.reload();
    } catch (err) { toast(err.message, 'error'); }
  });

  mount.querySelector('#cover-input')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      await api.users.uploadCover(form);
      toast('Cover picture updated.', 'success');
      location.reload();
    } catch (err) { toast(err.message, 'error'); }
  });

  mount.querySelector('#edit-profile')?.addEventListener('click', () => openEditProfile());

  mount.querySelector('#message-user')?.addEventListener('click', async () => {
    try {
      const { conversation } = await api.messages.openWith(u.id);
      navigate(`/messages/${conversation.id}`);
    } catch (err) { toast(err.message, 'error'); }
  });

  mount.querySelector('#connect-user')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      if (data.connection?.status === 'accepted') {
        const yes = await confirmDialog({ title: `Disconnect from ${u.displayName}?`, confirmText: 'Disconnect', danger: true });
        if (!yes) return;
        await api.users.disconnect(u.id);
        data.connection = null;
      } else {
        const result = await api.users.connect(u.id);
        data.connection = { status: result.status, incoming: false };
        toast(result.status === 'accepted' ? 'You are now connected.' : 'Request sent.', 'success');
      }
      button.innerHTML = connectLabel(data.connection);
    } catch (err) { toast(err.message, 'error'); }
  });

  mount.querySelector('#report-user')?.addEventListener('click', () => openReportDialog('user', u.id, 'member'));
}

export function openEditProfile(onDone) {
  const u = store.user;
  modal({
    title: 'Edit your profile',
    body: `
      <form id="profile-form">
        <div class="field">
          <label>Display name</label>
          <input class="input" name="displayName" value="${esc(u.displayName)}" maxlength="40" required>
        </div>
        <div class="field">
          <label>About you</label>
          <textarea class="textarea" name="bio" maxlength="400" placeholder="Tell your class a little about yourself.">${esc(u.bio || '')}</textarea>
        </div>
        <div class="grid grid-2" style="gap:0 1rem">
          <div class="field">
            <label>Favourite subject</label>
            <input class="input" name="favouriteSubject" value="${esc(u.favouriteSubject || '')}" maxlength="40" placeholder="Science">
          </div>
          <div class="field">
            <label>Class</label>
            <input class="input" name="classSection" value="${esc(u.classSection || 'Grade 8')}" maxlength="40">
          </div>
        </div>
        <label class="checkbox">
          <input type="checkbox" name="showOnline" ${u.showOnline ? 'checked' : ''}>
          <span>Show classmates when I am online</span>
        </label>
      </form>`,
    footer: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="save-profile">Save changes</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('#save-profile').addEventListener('click', async (event) => {
        const form = root.querySelector('#profile-form');
        if (!form.reportValidity()) return;
        const button = event.currentTarget;
        button.disabled = true;
        const raw = Object.fromEntries(new FormData(form));
        try {
          const result = await api.users.updateMe({
            displayName: raw.displayName,
            bio: raw.bio,
            favouriteSubject: raw.favouriteSubject,
            classSection: raw.classSection,
            showOnline: Boolean(raw.showOnline)
          });
          Object.assign(store.user, result.user);
          close();
          toast('Profile saved.', 'success');
          if (onDone) onDone();
          else location.reload();
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
        }
      });
    }
  });
}
