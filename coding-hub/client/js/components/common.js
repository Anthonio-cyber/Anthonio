// ==========================================================
// Pieces reused on several screens: avatars, user chips,
// empty states, the report dialog and the user picker.
// ==========================================================
import { esc, initials, timeAgo, richText } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { modal, toast, withBusy } from '../lib/ui.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';

export function avatar(user, size = 'md', showPresence = false) {
  if (!user) return `<div class="avatar avatar-${size}">?</div>`;
  const inner = user.avatarUrl
    ? `<img src="${esc(user.avatarUrl)}" alt="" loading="lazy">`
    : esc(initials(user.displayName || user.username));
  const dot = showPresence
    ? `<span class="presence-dot ${user.online ? 'online' : ''}" title="${user.online ? 'Online' : 'Offline'}"></span>`
    : '';
  return `<span class="avatar-wrap"><span class="avatar avatar-${size}">${inner}</span>${dot}</span>`;
}

export function userLink(user, extra = '') {
  if (!user) return '<span class="faint">Unknown member</span>';
  return `<a href="#/profile/${esc(user.username)}" class="bold" style="color:inherit">${esc(user.displayName)}</a>${extra}`;
}

export function userRow(user, { presence = true, sub = '', action = '' } = {}) {
  if (!user) return '';
  return `
    <a class="list-item" href="#/profile/${esc(user.username)}">
      ${avatar(user, 'sm', presence)}
      <div class="meta">
        <div class="title">${esc(user.displayName)}</div>
        <div class="sub">${sub || `@${esc(user.username)}`}</div>
      </div>
      ${action}
    </a>`;
}

export function emptyState({ iconName = 'info', title, text = '', action = '' }) {
  return `
    <div class="empty">
      <div class="empty-icon">${icon(iconName, 24)}</div>
      <h3>${esc(title)}</h3>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${action}
    </div>`;
}

export function loadingBlock(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="card" style="display:flex;gap:.8rem">
      <div class="skeleton" style="width:44px;height:44px;border-radius:50%"></div>
      <div style="flex:1">
        <div class="skeleton" style="height:12px;width:35%;margin-bottom:.5rem"></div>
        <div class="skeleton" style="height:10px;width:85%;margin-bottom:.4rem"></div>
        <div class="skeleton" style="height:10px;width:60%"></div>
      </div>
    </div>`).join('');
}

export function levelPill(user) {
  if (!user) return '';
  return `<span class="badge badge-accent" title="${user.xp} XP">${icon('zap', 12)} Level ${user.level}</span>`;
}

export function roleBadge(user) {
  if (!user || user.role === 'user') return '';
  const tone = { super_admin: 'danger', admin: 'danger', moderator: 'warning' }[user.role] || '';
  return `<span class="badge ${tone ? `badge-${tone}` : ''}">${esc(user.roleName || user.role)}</span>`;
}

export function priorityBadge(priority) {
  const map = {
    urgent: { tone: 'danger', label: 'Urgent' },
    important: { tone: 'warning', label: 'Important' },
    normal: { tone: '', label: 'Normal' }
  };
  const p = map[priority] || map.normal;
  return `<span class="badge ${p.tone ? `badge-${p.tone}` : ''}">${p.label}</span>`;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const REPORT_REASONS = [
  ['bullying', 'Bullying'],
  ['harassment', 'Harassment'],
  ['inappropriate', 'Inappropriate content'],
  ['spam', 'Spam'],
  ['scam', 'Scam or trick'],
  ['impersonation', 'Pretending to be someone else'],
  ['other', 'Something else']
];

export function openReportDialog(targetType, targetId, label = '') {
  modal({
    title: `Report this ${label || targetType}`,
    body: `
      <p class="small muted">Reports go to the moderators. Nobody else can see who reported what.</p>
      <div class="field">
        <label>Why are you reporting it?</label>
        <select class="select" data-reason>
          ${REPORT_REASONS.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Anything else the moderators should know? (optional)</label>
        <textarea class="textarea" data-details placeholder="Add any details that would help."></textarea>
      </div>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-danger" data-send>Send report</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-send]').addEventListener('click', async (event) => {
        await withBusy(event.currentTarget, async () => {
          try {
            const result = await api.reports.create({
              targetType,
              targetId,
              reason: root.querySelector('[data-reason]').value,
              details: root.querySelector('[data-details]').value
            });
            close();
            toast(result.alreadyReported
              ? 'You have already reported this. The moderators are looking at it.'
              : 'Thank you. The moderators have been told.', 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
        }, 'Sending...');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Choose a member (used wherever one person picks another)
// ---------------------------------------------------------------------------
export function openUserPicker({ title = 'Choose a member', confirmText = 'Select', exclude = [], onPick }) {
  const dialog = modal({
    title,
    body: `
      <div class="field">
        <input class="input" data-search placeholder="Search members by name..." autocomplete="off">
      </div>
      <div data-results style="max-height:340px;overflow-y:auto">
        <div class="spinner spinner-center"></div>
      </div>`,
    footer: `<button type="button" class="btn" data-close>Cancel</button>`,
    onOpen: async ({ root, close }) => {
      const results = root.querySelector('[data-results]');
      const search = root.querySelector('[data-search]');

      const load = async (term = '') => {
        try {
          const { users } = await api.users.list(term ? `?search=${encodeURIComponent(term)}` : '');
          const list = users.filter((u) => u.id !== store.user.id && !exclude.includes(u.id));
          results.innerHTML = list.length
            ? `<div class="list">${list.map((u) => `
                <button type="button" class="list-item" data-id="${u.id}" style="border:0;background:none;cursor:pointer;width:100%">
                  ${avatar(u, 'sm', true)}
                  <div class="meta">
                    <div class="title">${esc(u.displayName)}</div>
                    <div class="sub">@${esc(u.username)} - Level ${u.level}</div>
                  </div>
                  <span class="btn btn-sm">${esc(confirmText)}</span>
                </button>`).join('')}</div>`
            : emptyState({ iconName: 'search', title: 'No members found' });
        } catch (err) {
          results.innerHTML = `<p class="small" style="color:var(--danger)">${esc(err.message)}</p>`;
        }
      };

      let timer;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => load(search.value.trim()), 220);
      });

      results.addEventListener('click', (event) => {
        const button = event.target.closest('[data-id]');
        if (!button) return;
        close();
        onPick(Number(button.dataset.id));
      });

      await load();
    }
  });
  return dialog;
}
