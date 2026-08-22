// ==========================================================
// Coding Hub - a member's profile (specification section 13),
// including the prominent Message button.
// ==========================================================
import { esc, timeAgo, formatDate, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, openReportDialog } from '../components/common.js';
import { toast, confirmDialog, withBusy } from '../lib/ui.js';
import { navigate } from '../lib/router.js';
import { progressBar, statTile } from '../components/learn.js';

export default async function profile({ mount, params }) {
  const username = params.username || store.user.username;
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.users.profile(username);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'search', title: 'Member not found', text: err.message,
      action: '<a class="btn btn-primary" href="#/members">Back to members</a>'
    })}</div>`;
    return;
  }

  render();

  function render() {
    const { user, stats, breakdown, badges, recent, isSelf } = data;

    mount.innerHTML = `
      <div class="page page-narrow">
        <section class="card profile-head">
          ${user.coverUrl ? `<div class="profile-cover" style="background-image:url('${esc(user.coverUrl)}')"></div>` : ''}
          <div class="profile-main">
            ${avatar(user, 'xl', true)}
            <div style="flex:1;min-width:0">
              <h1 style="margin:0 0 .2rem">
                ${esc(user.displayName)}
                ${user.verified ? `<span class="badge badge-info" title="Verified">${icon('check', 12)} Verified</span>` : ''}
                ${user.role !== 'user' ? `<span class="badge badge-accent">${esc(user.roleName)}</span>` : ''}
              </h1>
              <p class="muted small" style="margin:0">@${esc(user.username)}</p>
              ${user.bio ? `<p style="margin:.6rem 0 0">${esc(user.bio)}</p>` : ''}
              <div class="row row-tight small faint" style="margin-top:.5rem;flex-wrap:wrap">
                <span>${icon('calendar', 13)} Joined ${formatDate(user.joinedAt)}</span>
                ${user.location ? `<span>${icon('flag', 13)} ${esc(user.location)}</span>` : ''}
                ${user.online ? '<span class="badge badge-success">Online</span>'
    : (user.lastSeen ? `<span>Last seen ${timeAgo(user.lastSeen)}</span>` : '')}
              </div>
            </div>
          </div>

          <div class="profile-actions">
            ${isSelf
    ? `<a class="btn btn-primary" href="#/settings">${icon('settings', 16)} Edit profile</a>
                 <a class="btn" href="#/progress">${icon('chart', 16)} My progress</a>`
    : `<button type="button" class="btn btn-primary btn-lg" data-message ${data.canMessage ? '' : 'disabled'}>
                   ${icon('message', 17)} Message
                 </button>
                 <button type="button" class="btn" data-connect>
                   ${connectLabel(data.connection)}
                 </button>
                 <button type="button" class="btn btn-ghost" data-block>
                   ${icon('block', 15)} ${data.blocked ? 'Unblock' : 'Block'}
                 </button>
                 <button type="button" class="btn btn-ghost" data-report>${icon('flag', 15)} Report</button>`}
          </div>
          ${!isSelf && !data.canMessage ? '<p class="small faint">This person is not accepting messages from you.</p>' : ''}
        </section>

        <div class="grid grid-4" style="margin:1.25rem 0">
          ${statTile({ label: 'Level', value: `${user.level} ${user.levelTitle || ''}`, iconName: 'trophy', tone: 'accent' })}
          ${statTile({ label: 'XP', value: user.xp, iconName: 'star', tone: 'accent' })}
          ${statTile({ label: 'Lessons completed', value: stats.lessonsCompleted, iconName: 'book' })}
          ${statTile({ label: 'Questions answered', value: stats.questionsAnswered, iconName: 'target' })}
          ${statTile({ label: 'Accuracy', value: `${stats.accuracy}%`, iconName: 'chart' })}
          ${statTile({ label: 'Challenges', value: stats.challengesCompleted, iconName: 'zap' })}
          ${statTile({ label: 'Badges', value: badges.length, iconName: 'award' })}
          ${statTile({ label: 'Streak', value: user.streakDays, iconName: 'fire' })}
        </div>

        ${badges.length ? `
          <div class="card">
            <div class="card-header"><span class="card-title-icon">${icon('award', 17)}</span><h3>Badges</h3></div>
            <div class="badge-grid">
              ${badges.map((b) => `
                <div class="badge-tile earned">
                  <span class="badge-mark">${icon(b.icon || 'award', 20)}</span>
                  <strong>${esc(b.name)}</strong>
                  <p class="small muted">${esc(b.description)}</p>
                  <span class="small faint">${timeAgo(b.awarded_at)}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}

        <div class="grid grid-2" style="margin-top:1.25rem">
          <div class="card">
            <div class="card-header"><span class="card-title-icon">${icon('book', 17)}</span><h3>Progress by subject</h3></div>
            ${breakdown.length ? `
              <div class="list">
                ${breakdown.map((s) => `
                  <div class="list-item">
                    <div class="meta">
                      <div class="title">${esc(s.name)}</div>
                      <div class="sub">${s.completed}/${s.lessons} lessons &middot; ${s.answered} questions</div>
                      ${progressBar(s.percentComplete)}
                    </div>
                    <span class="badge">${s.percentComplete}%</span>
                  </div>`).join('')}
              </div>` : '<p class="small faint center">Nothing started yet.</p>'}
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title-icon">${icon('clock', 17)}</span><h3>Recent activity</h3></div>
            ${recent.length ? `
              <div class="list">
                ${recent.map((a) => `
                  <a class="list-item" href="${esc(a.link)}">
                    <span class="lesson-status ${a.kind === 'lesson_completed' ? 'done' : ''}">
                      ${icon(a.kind === 'lesson_completed' ? 'check' : 'play', 14)}
                    </span>
                    <div class="meta">
                      <div class="title">${esc(a.title)}</div>
                      <div class="sub">${esc(a.subtitle)} &middot; ${timeAgo(a.at)}</div>
                    </div>
                  </a>`).join('')}
              </div>` : '<p class="small faint center">Nothing yet.</p>'}
          </div>
        </div>
      </div>`;

    wire();
  }

  function connectLabel(connection) {
    if (!connection) return `${icon('plus', 15)} Connect`;
    if (connection.status === 'accepted') return `${icon('check', 15)} Connected`;
    return connection.incoming ? `${icon('check', 15)} Accept` : `${icon('clock', 15)} Requested`;
  }

  function wire() {
    delegate(mount, 'click', '[data-message]', async (event) => {
      await withBusy(event.target.closest('button'), async () => {
        try {
          const { conversation } = await api.messages.openWith(data.user.id);
          navigate(`/messages/${conversation.id}`);
        } catch (err) {
          toast(err.message, 'error');
        }
      }, 'Opening...');
    });

    delegate(mount, 'click', '[data-connect]', async () => {
      try {
        if (data.connection?.status === 'accepted') {
          const sure = await confirmDialog({
            title: 'Disconnect?',
            message: `You will no longer be connected with ${data.user.displayName}.`,
            confirmText: 'Disconnect'
          });
          if (!sure) return;
          await api.users.disconnect(data.user.id);
          data.connection = null;
        } else {
          const result = await api.users.connect(data.user.id);
          data.connection = { status: result.status, incoming: false };
        }
        data = await api.users.profile(data.user.username);
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    delegate(mount, 'click', '[data-block]', async () => {
      try {
        if (data.blocked) {
          await api.users.unblock(data.user.id);
          toast('Unblocked.', 'success');
        } else {
          const sure = await confirmDialog({
            title: `Block ${data.user.displayName}?`,
            message: 'They will not be able to message you, and any connection between you is removed.',
            confirmText: 'Block',
            danger: true
          });
          if (!sure) return;
          await api.users.block(data.user.id);
          toast('Blocked.', 'success');
        }
        data = await api.users.profile(data.user.username);
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    delegate(mount, 'click', '[data-report]', () => {
      openReportDialog('user', data.user.id, 'member');
    });
  }

  setPageTitle(data.user.displayName);
}
