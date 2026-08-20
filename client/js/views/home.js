// ==========================================================
// Home dashboard - the first screen after signing in.
// ==========================================================
import { esc, timeAgo, dueLabel, formatDateTime, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, on } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, loadingBlock, priorityBadge } from '../components/common.js';
import { renderPostCard, wirePostList } from '../components/post-card.js';
import { toast } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

export default async function home({ mount }) {
  setPageTitle('Home');
  mount.innerHTML = `<div class="page"><div class="with-rail">
    <div>${loadingBlock(3)}</div><div class="rail"></div>
  </div></div>`;

  let data;
  try {
    data = await api.dashboard();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'warning', title: 'The dashboard could not load', text: err.message
    })}</div>`;
    return;
  }

  mount.innerHTML = `
    <div class="page">
      <div class="with-rail">
        <div class="col" style="gap:1.25rem">
          ${heroSection(data)}
          ${cardsSection(data)}
          ${data.gameInvites.length ? gameInviteSection(data.gameInvites) : ''}
          ${announcementSection(data)}
          ${homeworkSection(data)}
          ${postsSection(data)}
          <div class="rail rail-inline mobile-rail">${railContent(data)}</div>
        </div>
        <aside class="rail desktop-rail">${railContent(data)}</aside>
      </div>
    </div>`;

  wirePostList(mount, { onChange: () => navigate('/feed') });
  wireHome(mount, data);

  const unsubscribe = on('presence', () => refreshOnline(mount));
  return { destroy: unsubscribe };
}

function heroSection(data) {
  const user = store.user;
  return `
    <section class="hero-card">
      <div class="hero-glow"></div>
      <div class="hero-content">
        <div class="hero-main">
          <h1>Welcome back, ${esc(user.displayName.split(' ')[0])} <span class="wave">&#128075;</span></h1>
          <p class="muted">${esc(data.communityName)} - here is what is happening today.</p>
          <div class="row" style="margin-top:.9rem">
            <a class="btn btn-primary" href="#/feed">${icon('feed', 16)} Open the feed</a>
            <a class="btn" href="#/games">${icon('game', 16)} Gaming Hub</a>
            <a class="btn" href="#/homework">${icon('book', 16)} Homework</a>
          </div>
        </div>
        <div class="hero-level">
          ${avatar(user, 'lg')}
          <div style="flex:1;min-width:0">
            <div class="row row-tight" style="justify-content:space-between">
              <span class="bold">Level ${user.level}</span>
              <span class="tiny faint">${user.xpIntoLevel}/${user.xpForNextLevel} XP</span>
            </div>
            <div class="level-bar" style="margin:.35rem 0"><span style="width:${user.levelProgress}%"></span></div>
            <div class="tiny faint">${user.xp} XP in total</div>
          </div>
        </div>
      </div>
    </section>`;
}

function cardsSection(data) {
  const c = data.cards;
  const tiles = [
    { icon: 'book', label: 'Homework due', value: c.homework.outstanding,
      sub: c.homework.overdue ? `${c.homework.overdue} overdue` : (c.homework.dueToday ? `${c.homework.dueToday} due today` : 'All caught up'),
      tone: c.homework.overdue ? 'danger' : (c.homework.dueToday ? 'warning' : 'success'), link: '#/homework' },
    { icon: 'message', label: 'Unread messages', value: c.unreadMessages, sub: c.unreadMessages ? 'Tap to read' : 'Nothing new', link: '#/messages' },
    { icon: 'users', label: 'Your clubs', value: c.clubCount, sub: c.clubCount ? 'Open your clubs' : 'Join one today', link: '#/clubs?mine=true' },
    { icon: 'game', label: 'Games played', value: c.gameStats.played, sub: `${c.gameStats.wins} wins`, link: '#/games' },
    { icon: 'fire', label: 'Activity streak', value: c.streakDays, sub: plural(c.streakDays, 'day'), tone: c.streakDays >= 3 ? 'warning' : '' },
    { icon: 'megaphone', label: 'Announcements', value: data.announcements.length, sub: 'Latest notices', link: '#/announcements' }
  ];

  return `
    <section>
      <div class="grid grid-3">
        ${tiles.map((t) => {
    const inner = `
            <div class="stat-icon" ${t.tone ? `style="background:var(--${t.tone}-soft);color:var(--${t.tone})"` : ''}>${icon(t.icon, 19)}</div>
            <div class="stat-body">
              <div class="stat-value">${t.value}</div>
              <div class="stat-label">${esc(t.label)}</div>
              <div class="tiny faint truncate">${esc(t.sub)}</div>
            </div>`;
    return t.link
      ? `<a class="stat card-hover" href="${t.link}" style="color:inherit;text-decoration:none">${inner}</a>`
      : `<div class="stat">${inner}</div>`;
  }).join('')}
      </div>
    </section>`;
}

function gameInviteSection(invites) {
  return `
    <section class="card" style="border-color:var(--accent)">
      <div class="card-header">
        <span class="card-title-icon">${icon('game', 17)}</span>
        <h3>Game invitations</h3>
      </div>
      <div class="list">
        ${invites.map((invite) => `
          <div class="list-item">
            ${avatar(invite.from, 'sm', true)}
            <div class="meta">
              <div class="title">${esc(invite.from?.displayName || 'A classmate')} invited you to ${esc(invite.gameName)}</div>
              <div class="sub">Accept to start playing straight away.</div>
            </div>
            <div class="row row-tight">
              <button class="btn btn-sm btn-primary" data-invite-accept="${invite.id}">Accept</button>
              <button class="btn btn-sm" data-invite-decline="${invite.id}">Decline</button>
            </div>
          </div>`).join('')}
      </div>
    </section>`;
}

function announcementSection(data) {
  if (!data.latestAnnouncement) return '';
  const a = data.latestAnnouncement;
  return `
    <section class="card announcement-highlight ${a.priority}">
      <div class="card-header">
        <span class="card-title-icon" style="background:var(--${a.priority === 'urgent' ? 'danger' : (a.priority === 'important' ? 'warning' : 'accent')}-soft);color:var(--${a.priority === 'urgent' ? 'danger' : (a.priority === 'important' ? 'warning' : 'accent')})">
          ${icon(a.pinned ? 'pin' : 'megaphone', 17)}
        </span>
        <h3>${a.pinned ? 'Pinned announcement' : 'Latest announcement'}</h3>
        <a class="btn btn-sm btn-ghost" href="#/announcements">See all</a>
      </div>
      <h2 style="margin-bottom:.35rem">${esc(a.title)}</h2>
      <p class="muted pre-wrap" style="margin-bottom:.6rem">${esc(a.message)}</p>
      <div class="row row-tight small faint">
        ${priorityBadge(a.priority)}
        <span>${esc(a.author?.displayName || 'Staff')}</span>
        <span>-</span>
        <span>${timeAgo(a.publishAt)}</span>
      </div>
    </section>`;
}

function homeworkSection(data) {
  return `
    <section class="card">
      <div class="card-header">
        <span class="card-title-icon">${icon('book', 17)}</span>
        <h3>Homework due</h3>
        <a class="btn btn-sm btn-ghost" href="#/homework">Open homework</a>
      </div>
      ${data.homework.length ? `
        <div class="list">
          ${data.homework.map((h) => {
    const due = dueLabel(h.dueDate);
    return `
              <a class="list-item" href="#/homework/${h.id}">
                <span class="subject-dot">${esc(h.subject.slice(0, 2).toUpperCase())}</span>
                <div class="meta">
                  <div class="title">${esc(h.title)}</div>
                  <div class="sub">${esc(h.subject)}</div>
                </div>
                <span class="badge ${due.tone ? `badge-${due.tone}` : ''}">${esc(due.text)}</span>
              </a>`;
  }).join('')}
        </div>`
    : emptyState({ iconName: 'check', title: 'No homework outstanding', text: 'Everything is marked as done. Nice work.' })}
    </section>`;
}

function postsSection(data) {
  return `
    <section>
      <div class="section-title">${icon('feed', 14)} Recent posts</div>
      ${data.posts.length
    ? `<div class="col" style="gap:1rem" data-post-list>${data.posts.map(renderPostCard).join('')}</div>`
    : `<div class="card">${emptyState({
      iconName: 'feed',
      title: 'The feed is quiet',
      text: 'Be the first to post something for the class.',
      action: '<a class="btn btn-primary" href="#/feed">Write a post</a>'
    })}</div>`}
    </section>`;
}

function railContent(data) {
  return `
    ${onlineCard(data.onlineNow)}
    ${eventsCard(data.events)}
    ${clubsCard(data)}
    ${data.leaderboardEnabled ? leaderboardCard(data.topPlayers) : ''}`;
}

function onlineCard(users) {
  return `
    <div class="card" data-online-card>
      <div class="card-header">
        <span class="card-title-icon" style="background:var(--success-soft);color:var(--success)">${icon('users', 17)}</span>
        <h3>Online now</h3>
        <span class="badge badge-success" data-online-count>${users.length}</span>
      </div>
      <div data-online-list>
        ${users.length
    ? `<div class="list">${users.map((u) => `
            <a class="list-item" href="#/profile/${esc(u.username)}">
              ${avatar(u, 'sm', true)}
              <div class="meta">
                <div class="title">${esc(u.displayName)}</div>
                <div class="sub">Level ${u.level}</div>
              </div>
            </a>`).join('')}</div>`
    : '<p class="small faint center" style="padding:.5rem 0">Nobody else is online right now.</p>'}
      </div>
    </div>`;
}

function eventsCard(events) {
  if (!events.length) return '';
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title-icon">${icon('calendar', 17)}</span>
        <h3>Coming up</h3>
      </div>
      <div class="list">
        ${events.map((e) => `
          <div class="list-item">
            <span class="date-chip">
              <span class="tiny">${new Date(e.startsAt.replace(' ', 'T')).toLocaleDateString(undefined, { month: 'short' })}</span>
              <span class="bold">${new Date(e.startsAt.replace(' ', 'T')).getDate()}</span>
            </span>
            <div class="meta">
              <div class="title">${esc(e.title)}</div>
              <div class="sub">${esc(e.clubName || 'Class event')} - ${esc(formatDateTime(e.startsAt))}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function clubsCard(data) {
  const clubs = data.myClubs.length ? data.myClubs : data.popularClubs;
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title-icon">${icon('users', 17)}</span>
        <h3>${data.myClubs.length ? 'Your clubs' : 'Popular clubs'}</h3>
        <a class="btn btn-sm btn-ghost" href="#/clubs">All</a>
      </div>
      ${clubs.length ? `
        <div class="list">
          ${clubs.slice(0, 5).map((c) => `
            <a class="list-item" href="#/clubs/${c.id}">
              <span class="club-logo club-logo-sm">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : esc(c.name.slice(0, 2).toUpperCase())}</span>
              <div class="meta">
                <div class="title">${esc(c.name)}</div>
                <div class="sub">${plural(c.memberCount, 'member')}</div>
              </div>
            </a>`).join('')}
        </div>`
    : '<p class="small faint center" style="padding:.5rem 0">No clubs yet. <a href="#/clubs">Create the first one.</a></p>'}
    </div>`;
}

function leaderboardCard(players) {
  if (!players.length) return '';
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('trophy', 17)}</span>
        <h3>Top of the class</h3>
        <a class="btn btn-sm btn-ghost" href="#/leaderboard">All</a>
      </div>
      <div class="list">
        ${players.map((p, i) => `
          <a class="list-item" href="#/profile/${esc(p.username)}">
            <span class="rank rank-${i + 1}">${i + 1}</span>
            ${avatar(p, 'xs')}
            <div class="meta">
              <div class="title">${esc(p.displayName)}</div>
            </div>
            <span class="badge badge-accent">${p.xp} XP</span>
          </a>`).join('')}
      </div>
    </div>`;
}

async function refreshOnline(mount) {
  try {
    const { users } = await api.users.online();
    for (const card of mount.querySelectorAll('[data-online-card]')) {
      card.querySelector('[data-online-count]').textContent = users.length;
      card.querySelector('[data-online-list]').innerHTML = users.length
        ? `<div class="list">${users.map((u) => `
            <a class="list-item" href="#/profile/${esc(u.username)}">
              ${avatar(u, 'sm', true)}
              <div class="meta">
                <div class="title">${esc(u.displayName)}</div>
                <div class="sub">Level ${u.level}</div>
              </div>
            </a>`).join('')}</div>`
        : '<p class="small faint center" style="padding:.5rem 0">Nobody else is online right now.</p>';
    }
  } catch { /* the list simply stays as it was */ }
}

function wireHome(mount, data) {
  mount.addEventListener('click', async (event) => {
    const accept = event.target.closest('[data-invite-accept]');
    const decline = event.target.closest('[data-invite-decline]');
    if (!accept && !decline) return;

    const id = Number((accept || decline).dataset.inviteAccept || (accept || decline).dataset.inviteDecline);
    try {
      const result = await api.games.respondInvite(id, accept ? 'accept' : 'decline');
      if (result.status === 'accepted') {
        navigate(`/games/${result.match.gameKey}?match=${result.match.id}`);
      } else {
        toast('Invitation declined.', 'info');
        (accept || decline).closest('.list-item').remove();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
