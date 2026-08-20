// ==========================================================
// The notification centre.
// ==========================================================
import { esc, timeAgo } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, on, refreshCounts } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';
import { toast, confirmDialog } from '../lib/ui.js';

const KIND_ICON = {
  message: 'message', comment: 'comment', like: 'heart', announcement: 'megaphone',
  homework: 'book', homework_reminder: 'clock', club_invite: 'users', club_join_request: 'users',
  club_post: 'feed', club: 'users', game_invite: 'game', game_result: 'trophy',
  achievement: 'award', connection: 'users', report: 'flag', moderation: 'shield',
  invite_used: 'ticket', event: 'calendar'
};

export default async function notifications({ mount }) {
  setPageTitle('Notifications');
  let onlyUnread = false;

  mount.innerHTML = `
    <div class="page page-narrow">
      <div class="row" style="margin-bottom:1rem">
        <div>
          <h1 style="margin:0">Notifications</h1>
          <p class="muted small" style="margin:0">Everything that happened while you were away.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="mark-all">${icon('check', 14)} Mark all read</button>
        <button class="btn btn-sm btn-ghost" id="clear-all">${icon('trash', 14)}</button>
      </div>

      <div class="btn-group" style="margin-bottom:1.25rem">
        <button data-unread="false" class="active">All</button>
        <button data-unread="true">Unread</button>
      </div>

      <div id="notification-list"><div class="spinner spinner-center"></div></div>
    </div>`;

  async function load() {
    const list = mount.querySelector('#notification-list');
    list.innerHTML = '<div class="spinner spinner-center"></div>';
    try {
      const data = await api.notifications.list(onlyUnread ? '?unread=true&limit=60' : '?limit=60');
      list.innerHTML = data.notifications.length
        ? `<div class="card card-flush"><div class="list">${data.notifications.map(row).join('')}</div></div>`
        : `<div class="card">${emptyState({
          iconName: 'bell',
          title: onlyUnread ? 'Nothing unread' : 'No notifications yet',
          text: 'You will be told about messages, homework, announcements and game invitations here.'
        })}</div>`;
      refreshCounts();
    } catch (err) {
      list.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  mount.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-unread]');
    if (tab) {
      onlyUnread = tab.dataset.unread === 'true';
      for (const b of mount.querySelectorAll('[data-unread]')) b.classList.toggle('active', b === tab);
      await load();
      return;
    }

    if (event.target.closest('#mark-all')) {
      try { await api.notifications.markAllRead(); await load(); toast('All marked as read.', 'success'); } catch (err) { toast(err.message, 'error'); }
      return;
    }

    if (event.target.closest('#clear-all')) {
      const yes = await confirmDialog({ title: 'Clear every notification?', confirmText: 'Clear all', danger: true });
      if (!yes) return;
      try { await api.notifications.clear(); await load(); } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const remove = event.target.closest('[data-remove]');
    if (remove) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await api.notifications.remove(Number(remove.dataset.remove));
        remove.closest('.list-item').remove();
        refreshCounts();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const item = event.target.closest('[data-notification]');
    if (item && !item.classList.contains('read')) {
      api.notifications.markRead(Number(item.dataset.notification)).then(refreshCounts).catch(() => {});
      item.classList.add('read');
    }
  });

  const off = on('notification', () => load());
  await load();
  return { destroy: off };
}

function row(n) {
  const iconName = KIND_ICON[n.kind] || 'bell';
  return `
    <a class="list-item notification ${n.read ? 'read' : 'unread'}" href="${esc(n.link || '#/')}"
       data-notification="${n.id}">
      <span class="notification-icon">${icon(iconName, 16)}</span>
      <div class="meta">
        <div class="title" style="white-space:normal">${esc(n.title)}</div>
        ${n.body ? `<div class="sub" style="white-space:normal">${esc(n.body)}</div>` : ''}
        <div class="tiny faint">${timeAgo(n.createdAt)}</div>
      </div>
      ${n.read ? '' : '<span class="unread-dot"></span>'}
      <button class="icon-button" data-remove="${n.id}" aria-label="Remove">${icon('close', 15)}</button>
    </a>`;
}
