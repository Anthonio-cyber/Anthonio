// ==========================================================
// Coding Hub - the administration dashboard (sections 36-52).
//
// Every section checks a permission before it is shown, and the
// server checks again on every request. Hiding a button is never
// treated as security.
// ==========================================================
import { esc, timeAgo, formatDateTime, debounce, delegate, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';
import { toast, modal, confirmDialog, contextMenu, promptDialog, withBusy } from '../lib/ui.js';
import { statTile, progressBar } from '../components/learn.js';
import { openAnnouncementForm } from './announcements.js';
import {
  subjectsSection, topicsSection, lessonsSection, questionsSection, learningSection
} from './admin-curriculum.js';

const SECTIONS = [
  { key: 'overview',      label: 'Overview',      icon: 'chart',     permission: 'admin.access' },
  { key: 'users',         label: 'Users',         icon: 'users',     permission: 'users.view' },
  { key: 'subjects',      label: 'Subjects',      icon: 'book',      permission: 'subjects.view' },
  { key: 'topics',        label: 'Topics',        icon: 'grid',      permission: 'subjects.view' },
  { key: 'lessons',       label: 'Lessons',       icon: 'play',      permission: 'subjects.view' },
  { key: 'questions',     label: 'Questions',     icon: 'target',    permission: 'subjects.view' },
  { key: 'messages',      label: 'Messaging',     icon: 'message',   permission: 'messages.moderate' },
  { key: 'reports',       label: 'Reports',       icon: 'shield',    permission: 'reports.view' },
  { key: 'badges',        label: 'Badges',        icon: 'award',     permission: 'badges.manage' },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone', permission: 'announcements.create' },
  { key: 'analytics',     label: 'Analytics',     icon: 'chart',     permission: 'analytics.view' },
  { key: 'learning',      label: 'Content health', icon: 'zap',      permission: 'analytics.view' },
  { key: 'activity',      label: 'Activity log',  icon: 'clock',     permission: 'logs.view' },
  { key: 'permissions',   label: 'Permissions',   icon: 'lock',      permission: 'admin.access' },
  { key: 'settings',      label: 'Settings',      icon: 'settings',  permission: 'settings.manage' }
];

export default async function admin({ mount, params, query = {} }) {
  if (!can('admin.access')) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'lock', title: 'Administrators only',
      text: 'You do not have permission to open this area.',
      action: '<a class="btn btn-primary" href="#/">Back to the dashboard</a>'
    })}</div>`;
    return;
  }

  const available = SECTIONS.filter((s) => can(s.permission));
  const section = available.some((s) => s.key === params.section) ? params.section : 'overview';
  setPageTitle('Admin');

  mount.innerHTML = `
    <div class="page page-wide">
      <div class="row" style="margin-bottom:1rem">
        <span class="card-title-icon" style="background:var(--danger-soft);color:var(--danger)">${icon('crown', 18)}</span>
        <div>
          <h1 style="margin:0">Admin dashboard</h1>
          <p class="muted small" style="margin:0">
            Signed in as ${esc(store.user.displayName)} (${esc(store.user.roleName)}).
          </p>
        </div>
      </div>

      <div class="admin-tabs">
        ${available.map((s) => `
          <a href="#/admin/${s.key}" class="chip ${s.key === section ? 'active' : ''}">${icon(s.icon, 14)} ${esc(s.label)}</a>`).join('')}
      </div>

      <div id="admin-panel" style="margin-top:1.25rem"><div class="spinner spinner-center"></div></div>
    </div>`;

  const panel = mount.querySelector('#admin-panel');
  const renderers = {
    overview: overviewSection,
    users: usersSection,
    subjects: subjectsSection,
    topics: (node) => topicsSection(node, query),
    lessons: (node) => lessonsSection(node, query),
    questions: (node) => questionsSection(node, query),
    messages: messagingSection,
    reports: reportsSection,
    badges: badgesSection,
    announcements: announcementsSection,
    analytics: analyticsSection,
    learning: learningSection,
    activity: activitySection,
    permissions: permissionsSection,
    settings: settingsSection
  };

  try {
    await renderers[section](panel);
  } catch (err) {
    panel.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }
}

// ---------------------------------------------------------------------------
// Overview (section 37)
// ---------------------------------------------------------------------------
async function overviewSection(panel) {
  const data = await api.admin.stats();
  const s = data.stats;

  const tiles = [
    { label: 'Total users', value: s.totalUsers, icon: 'users', link: '#/admin/users' },
    { label: 'Active users', value: s.activeUsers, icon: 'check', tone: 'success' },
    { label: 'Online now', value: s.onlineUsers, icon: 'zap', tone: 'accent' },
    { label: 'New this week', value: s.newUsers, icon: 'star' },
    { label: 'Subjects', value: s.subjects, icon: 'book', link: '#/admin/subjects' },
    { label: 'Topics', value: s.topics, icon: 'grid', link: '#/admin/topics' },
    { label: 'Lessons', value: s.lessons, icon: 'play', link: '#/admin/lessons' },
    { label: 'Draft lessons', value: s.draftLessons, icon: 'edit', tone: s.draftLessons ? 'warning' : '', link: '#/admin/lessons' },
    { label: 'Questions', value: s.questions, icon: 'target', link: '#/admin/questions' },
    { label: 'Challenges', value: s.challenges, icon: 'zap' },
    { label: 'Questions answered', value: s.questionsAnswered, icon: 'chart', link: '#/admin/analytics' },
    { label: 'Lessons completed', value: s.lessonsCompleted, icon: 'check', tone: 'success' },
    { label: 'Active conversations', value: s.activeConversations, icon: 'message', link: '#/admin/messages' },
    { label: 'Messages sent', value: s.messagesSent, icon: 'send' },
    { label: 'Open reports', value: s.openReports, icon: 'shield', tone: s.openReports ? 'danger' : '', link: '#/admin/reports' },
    { label: 'Suspended', value: s.suspended, icon: 'block', tone: s.suspended ? 'warning' : '' }
  ];

  panel.innerHTML = `
    <div class="grid grid-4">
      ${tiles.map((t) => statTile({ label: t.label, value: t.value, iconName: t.icon, tone: t.tone, link: t.link })).join('')}
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header">
        <span class="card-title-icon">${icon('clock', 17)}</span>
        <h3>Recent administrator activity</h3>
        ${can('logs.view') ? '<a class="btn btn-sm btn-ghost" href="#/admin/activity">Full log</a>' : ''}
      </div>
      ${data.recentActivity.length
    ? `<div class="list">${data.recentActivity.map(logRow).join('')}</div>`
    : '<p class="small faint center">Nothing has happened yet.</p>'}
    </div>`;
}

function logRow(entry) {
  return `
    <div class="list-item">
      ${avatar(entry.actor, 'xs')}
      <div class="meta">
        <div class="title" style="white-space:normal">
          <strong>${esc(entry.actor?.displayName || 'System')}</strong>
          ${esc(readableAction(entry.action))}
          ${entry.details ? `<span class="faint">- ${esc(entry.details)}</span>` : ''}
        </div>
        <div class="sub">${timeAgo(entry.createdAt)}${entry.targetType ? ` - ${esc(entry.targetType)} ${esc(String(entry.targetId))}` : ''}</div>
      </div>
    </div>`;
}

function readableAction(action) {
  return String(action).replace(/_/g, ' ').replace(/\./g, ' ').toLowerCase();
}

// ---------------------------------------------------------------------------
// Users (section 38)
// ---------------------------------------------------------------------------
async function usersSection(panel) {
  const filters = { search: '', status: '', role: '' };
  await load();

  async function load() {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    const data = await api.admin.users(`?${query.toString()}`);
    render(data);
  }

  function render({ users, total, roles }) {
    panel.innerHTML = `
      <div class="admin-filters">
        <input class="input" data-search placeholder="Search name, username or email..." value="${esc(filters.search)}">
        <select class="select" data-status>
          <option value="">Any status</option>
          ${['active', 'suspended', 'banned', 'deleted'].map((v) => `
            <option value="${v}" ${filters.status === v ? 'selected' : ''}>${v[0].toUpperCase()}${v.slice(1)}</option>`).join('')}
        </select>
        <select class="select" data-role>
          <option value="">Any role</option>
          ${roles.map((r) => `<option value="${r.key}" ${filters.role === r.key ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
        </select>
        ${can('users.create') ? `<button type="button" class="btn btn-primary btn-sm" data-new>${icon('plus', 15)} New user</button>` : ''}
      </div>

      <p class="small faint">${plural(total, 'account')} match.</p>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Member</th><th>Role</th><th>Level</th><th>Learning</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr data-id="${u.id}">
                <td>
                  <div class="row row-tight">
                    ${avatar(u, 'xs')}
                    <div>
                      <div class="bold">${esc(u.displayName)}</div>
                      <div class="tiny faint">@${esc(u.username)}${u.email ? ` · ${esc(u.email)}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td><span class="badge ${u.role === 'super_admin' || u.role === 'admin' ? 'badge-danger' : (u.role === 'moderator' ? 'badge-warning' : '')}">${esc(u.roleName)}</span></td>
                <td class="small">${u.level} · ${u.xp} XP</td>
                <td class="small">${u.stats.lessonsCompleted} lessons<br>
                  <span class="tiny faint">${u.stats.questionsAnswered} questions · ${u.stats.accuracy}%</span></td>
                <td>
                  ${u.status === 'active' ? '<span class="badge badge-success">Active</span>'
    : `<span class="badge badge-danger">${esc(u.status)}</span>`}
                  ${u.canMessage ? '' : '<span class="badge badge-warning">Muted</span>'}
                  ${u.verified ? `<span class="badge badge-info" title="Verified">${icon('check', 11)}</span>` : ''}
                </td>
                <td class="right"><button type="button" class="icon-button" data-manage>${icon('more', 16)}</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    panel.querySelector('[data-search]').addEventListener('input', debounce((event) => {
      filters.search = event.target.value.trim();
      load();
    }, 300));
    panel.querySelector('[data-status]').addEventListener('change', (e) => { filters.status = e.target.value; load(); });
    panel.querySelector('[data-role]').addEventListener('change', (e) => { filters.role = e.target.value; load(); });
    panel.querySelector('[data-new]')?.addEventListener('click', () => openUserForm(roles, load));

    delegate(panel, 'click', '[data-manage]', async (_event, node) => {
      const id = Number(node.closest('[data-id]').dataset.id);
      const user = users.find((u) => u.id === id);
      const items = [
        { label: 'Open profile', action: 'profile', icon: 'user' },
        ...(can('users.roles') ? [{ label: 'Change role', action: 'role', icon: 'crown' }] : []),
        ...(can('users.suspend') ? [{ label: user.status === 'active' ? 'Suspend' : 'Make active', action: 'status', icon: 'block' }] : []),
        ...(can('users.suspend') && user.status !== 'banned' ? [{ label: 'Ban', action: 'ban', icon: 'block', danger: true }] : []),
        ...(can('users.restrict') ? [{ label: user.canMessage ? 'Restrict messaging' : 'Allow messaging', action: 'restrict', icon: 'message' }] : []),
        ...(can('users.verify') ? [{ label: user.verified ? 'Remove verification' : 'Verify account', action: 'verify', icon: 'check' }] : []),
        ...(can('users.password') ? [{ label: 'Reset password', action: 'password', icon: 'lock' }] : []),
        ...(can('users.xp') ? [{ label: 'Adjust XP', action: 'xp', icon: 'zap' }] : []),
        ...(can('users.xp') ? [{ label: 'Reset learning progress', action: 'reset', icon: 'refresh', danger: true }] : []),
        ...(can('users.badges') ? [{ label: 'Give a badge', action: 'badge', icon: 'award' }] : []),
        ...(can('permissions.manage') ? [{ label: 'Individual permissions', action: 'permissions', icon: 'lock' }] : []),
        ...(can('users.delete') ? ['-', { label: 'Delete account', action: 'delete', icon: 'trash', danger: true }] : [])
      ];

      const action = await contextMenu(node, items);
      if (!action) return;
      try {
        await runUserAction(action, user, roles, load);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
}

async function runUserAction(action, user, roles, reload) {
  if (action === 'profile') { window.location.hash = `#/profile/${user.username}`; return; }

  if (action === 'role') {
    const choice = await chooseDialog(`Change the role of ${user.displayName}`,
      roles.map((r) => [r.key, r.name]), user.role);
    if (!choice) return;
    await api.admin.setRole(user.id, choice);
    toast('Role changed.', 'success');
  }

  if (action === 'status') {
    const next = user.status === 'active' ? 'suspended' : 'active';
    const reason = next === 'suspended'
      ? await promptDialog({ title: 'Suspend this account', label: 'Reason (they will see this)', required: false })
      : '';
    if (next === 'suspended' && reason === null) return;
    await api.admin.setStatus(user.id, next, reason || '');
    toast(next === 'active' ? 'Account is active again.' : 'Account suspended.', 'success');
  }

  if (action === 'ban') {
    const reason = await promptDialog({ title: `Ban ${user.displayName}`, label: 'Reason', required: false });
    if (reason === null) return;
    const sure = await confirmDialog({
      title: `Ban ${user.displayName}?`,
      message: 'They will not be able to sign in at all.',
      confirmText: 'Ban', danger: true
    });
    if (!sure) return;
    await api.admin.setStatus(user.id, 'banned', reason || '');
    toast('Account banned.', 'success');
  }

  if (action === 'restrict') {
    await api.admin.restrict(user.id, !user.canMessage);
    toast(user.canMessage ? 'Messaging restricted.' : 'Messaging allowed again.', 'success');
  }

  if (action === 'verify') {
    await api.admin.updateUser(user.id, { verified: !user.verified });
    toast(user.verified ? 'Verification removed.' : 'Account verified.', 'success');
  }

  if (action === 'password') {
    const password = await promptDialog({
      title: `New password for ${user.displayName}`,
      label: 'They will have to change it when they next sign in',
      placeholder: 'At least 8 characters'
    });
    if (!password) return;
    await api.admin.resetPassword(user.id, password);
    toast('Password reset.', 'success');
  }

  if (action === 'xp') {
    const value = await promptDialog({
      title: `Adjust XP for ${user.displayName}`,
      label: 'How much? Use a minus sign to take XP away.',
      value: '10'
    });
    if (value === null) return;
    await api.admin.adjustXp(user.id, Number(value) || 0);
    toast('XP adjusted.', 'success');
  }

  if (action === 'reset') {
    const sure = await confirmDialog({
      title: `Reset ${user.displayName}'s progress?`,
      message: 'Every completed lesson, answered question and finished challenge is deleted, and their XP goes back to zero. This cannot be undone.',
      confirmText: 'Reset everything', danger: true
    });
    if (!sure) return;
    await api.admin.resetProgress(user.id);
    toast('Progress reset.', 'success');
  }

  if (action === 'badge') {
    const { badges } = await api.admin.badges();
    const choice = await chooseDialog(`Give a badge to ${user.displayName}`, badges.map((b) => [b.key, b.name]));
    if (!choice) return;
    await api.admin.setBadge(user.id, choice, false);
    toast('Badge given.', 'success');
  }

  if (action === 'permissions') { await openPermissionsDialog(user); return; }

  if (action === 'delete') {
    const sure = await confirmDialog({
      title: `Delete ${user.displayName}?`,
      message: 'The account is marked as deleted and they can no longer sign in.',
      confirmText: 'Delete', danger: true
    });
    if (!sure) return;
    await api.admin.deleteUser(user.id, false);
    toast('Account deleted.', 'success');
  }

  reload();
}

function openUserForm(roles, onSaved) {
  modal({
    title: 'New account',
    body: `
      <div class="field"><label>Username</label><input class="input" data-username></div>
      <div class="field"><label>Display name</label><input class="input" data-name></div>
      <div class="field"><label>Email (optional)</label><input class="input" data-email type="email"></div>
      <div class="field"><label>Temporary password</label>
        <input class="input" data-password placeholder="At least 8 characters">
        <span class="hint">They will be asked to change it when they first sign in.</span></div>
      <div class="field"><label>Role</label>
        <select class="select" data-role>
          ${roles.map((r) => `<option value="${r.key}">${esc(r.name)}</option>`).join('')}
        </select></div>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>Create account</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const payload = {
          username: root.querySelector('[data-username]').value.trim(),
          displayName: root.querySelector('[data-name]').value.trim(),
          email: root.querySelector('[data-email]').value.trim(),
          password: root.querySelector('[data-password]').value,
          role: root.querySelector('[data-role]').value
        };
        await withBusy(event.currentTarget, async () => {
          try {
            await api.admin.createUser(payload);
            close();
            toast('Account created.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Creating...');
      });
    }
  });
}

async function openPermissionsDialog(user) {
  const [{ permissions }, detail] = await Promise.all([api.admin.roles(), api.admin.user(user.id)]);
  const overrides = new Map(detail.permissions.map((p) => [p.permission_key, p.granted]));

  modal({
    title: `Permissions for ${user.displayName}`,
    size: 'modal-lg',
    body: `
      <p class="small muted">
        These sit on top of what the ${esc(user.roleName)} role already allows.
        "Role default" removes the override.
      </p>
      <div class="list">
        ${permissions.map((p) => {
    const value = overrides.has(p.key) ? (overrides.get(p.key) ? 'allow' : 'deny') : 'default';
    return `
          <div class="list-item">
            <div class="meta">
              <div class="title">${esc(p.key)}</div>
              <div class="sub">${esc(p.description)}</div>
            </div>
            <select class="select select-sm" data-permission="${esc(p.key)}">
              <option value="default" ${value === 'default' ? 'selected' : ''}>Role default</option>
              <option value="allow" ${value === 'allow' ? 'selected' : ''}>Allow</option>
              <option value="deny" ${value === 'deny' ? 'selected' : ''}>Deny</option>
            </select>
          </div>`;
  }).join('')}
      </div>`,
    footer: '<button type="button" class="btn btn-primary" data-close>Done</button>',
    onOpen: ({ root }) => {
      delegate(root, 'change', '[data-permission]', async (_event, node) => {
        const permission = node.dataset.permission;
        const value = node.value;
        try {
          await api.admin.setPermission(user.id, {
            permission,
            reset: value === 'default',
            granted: value === 'allow'
          });
          toast(`${permission}: ${value === 'default' ? 'role default' : value}`, 'success');
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}

function chooseDialog(title, options, current = '') {
  return new Promise((resolve) => {
    const { close } = modal({
      title,
      body: `<div class="field"><select class="select" data-choice>
        ${options.map(([value, label]) => `
          <option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`).join('')}
      </select></div>`,
      footer: `
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary" data-confirm>Apply</button>`,
      onOpen: ({ root }) => {
        root.querySelector('[data-cancel]').addEventListener('click', () => { close(); resolve(null); });
        root.querySelector('[data-confirm]').addEventListener('click', () => {
          const value = root.querySelector('[data-choice]').value;
          close();
          resolve(value);
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Messaging moderation (section 46)
// ---------------------------------------------------------------------------
async function messagingSection(panel) {
  const [stats, accessLog] = await Promise.all([
    api.admin.messageStats(),
    can('logs.view') ? api.admin.messageAccessLog() : Promise.resolve({ entries: [] })
  ]);

  panel.innerHTML = `
    <div class="grid grid-4">
      ${statTile({ label: 'Conversations', value: stats.conversations, iconName: 'message' })}
      ${statTile({ label: 'Messages', value: stats.messages, iconName: 'send' })}
      ${statTile({ label: 'Deleted', value: stats.deleted, iconName: 'trash' })}
      ${statTile({ label: 'Reported', value: stats.reported, iconName: 'flag', tone: stats.reported ? 'warning' : '' })}
      ${statTile({ label: 'Messaging restricted', value: stats.restricted, iconName: 'block', tone: stats.restricted ? 'warning' : '' })}
    </div>

    <div class="callout callout-warning" style="margin-top:1.25rem">
      <span class="callout-icon">${icon('shield', 16)}</span>
      <div>
        <strong>Private conversations stay private</strong>
        <p>
          A moderator can only open a conversation through a report, and must give a reason.
          Every time that happens it is written to the log below, and everybody in the
          conversation is told. There is no way to browse private messages from here.
        </p>
      </div>
    </div>

    ${can('logs.view') ? `
      <div class="card" style="margin-top:1.25rem">
        <div class="card-header">
          <span class="card-title-icon">${icon('eye', 17)}</span>
          <h3>Moderation access log</h3>
          <span class="badge">${accessLog.entries.length}</span>
        </div>
        ${accessLog.entries.length ? `
          <div class="list">
            ${accessLog.entries.map((e) => `
              <div class="list-item">
                ${avatar(e.moderator, 'xs')}
                <div class="meta">
                  <div class="title">${esc(e.moderator?.displayName || 'Unknown')} opened conversation ${e.conversationId}</div>
                  <div class="sub">${esc(e.reason)}${e.reportId ? ` · report ${e.reportId}` : ''} · ${timeAgo(e.createdAt)}</div>
                </div>
              </div>`).join('')}
          </div>` : '<p class="small faint center">No moderator has opened a private conversation.</p>'}
      </div>` : ''}`;
}

// ---------------------------------------------------------------------------
// Reports (sections 27 and 46)
// ---------------------------------------------------------------------------
async function reportsSection(panel) {
  let status = 'open';
  await load();

  async function load() {
    const data = await api.reports.list(`?status=${status}`);
    panel.innerHTML = `
      <div class="admin-tabs" style="margin-bottom:1rem">
        ${['open', 'reviewing', 'resolved', 'dismissed', 'all'].map((value) => `
          <button type="button" class="chip ${value === status ? 'active' : ''}" data-status="${value}">
            ${value[0].toUpperCase()}${value.slice(1)}
          </button>`).join('')}
      </div>

      ${data.reports.length ? `
        <div class="list card">
          ${data.reports.map((r) => `
            <div class="list-item" data-report="${r.id}">
              <span class="card-title-icon" style="background:var(--danger-soft);color:var(--danger)">${icon('flag', 15)}</span>
              <div class="meta">
                <div class="title">${esc(r.reason)} · ${esc(r.targetType)} ${r.targetId}</div>
                <div class="sub">
                  Reported by ${esc(r.reporter?.displayName || 'somebody')} · ${timeAgo(r.createdAt)}
                  ${r.details ? `<br>${esc(r.details)}` : ''}
                </div>
              </div>
              <span class="badge ${r.status === 'open' ? 'badge-danger' : ''}">${esc(r.status)}</span>
              ${can('reports.resolve') && ['open', 'reviewing'].includes(r.status)
    ? `<button type="button" class="btn btn-xs btn-primary" data-resolve="${r.id}">Handle</button>` : ''}
            </div>`).join('')}
        </div>`
    : emptyState({ iconName: 'shield', title: 'Nothing to review', text: 'No reports with that status.' })}`;

    delegate(panel, 'click', '[data-status]', (_event, node) => {
      status = node.dataset.status;
      load();
    });

    delegate(panel, 'click', '[data-resolve]', async (_event, node) => {
      const id = Number(node.dataset.resolve);
      const report = data.reports.find((r) => r.id === id);
      openResolveDialog(report, load);
    });
  }
}

function openResolveDialog(report, onSaved) {
  modal({
    title: `Report #${report.id}`,
    body: `
      <p class="small muted">
        ${esc(report.reason)} · ${esc(report.targetType)} ${report.targetId}<br>
        Reported by ${esc(report.reporter?.displayName || 'somebody')} ${timeAgo(report.createdAt)}
      </p>
      ${report.details ? `<div class="callout callout-info"><div><p>${esc(report.details)}</p></div></div>` : ''}
      <div class="field"><label>What did you decide?</label>
        <select class="select" data-status>
          <option value="resolved">Resolved - action taken</option>
          <option value="dismissed">Dismissed - nothing wrong</option>
          <option value="reviewing">Still looking into it</option>
        </select></div>
      <div class="field"><label>Note for the log</label>
        <textarea class="textarea" data-resolution rows="3"></textarea></div>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>Save</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        await withBusy(event.currentTarget, async () => {
          try {
            await api.reports.resolve(report.id, {
              status: root.querySelector('[data-status]').value,
              resolution: root.querySelector('[data-resolution]').value.trim()
            });
            close();
            toast('Report updated.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Badges (section 32)
// ---------------------------------------------------------------------------
async function badgesSection(panel) {
  await load();

  async function load() {
    const { badges } = await api.admin.badges();
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:1rem">
        <p class="muted small" style="margin:0">
          ${badges.length} badges. Built-in ones are awarded automatically; your own are given by hand.
        </p>
        <button type="button" class="btn btn-primary btn-sm" data-new>${icon('plus', 15)} New badge</button>
      </div>

      <div class="badge-grid">
        ${badges.map((b) => `
          <div class="badge-tile earned" data-badge="${esc(b.key)}">
            <span class="badge-mark">${icon(b.icon || 'award', 22)}</span>
            <strong>${esc(b.name)}</strong>
            <p class="small muted">${esc(b.description)}</p>
            <span class="small faint">${b.awarded} awarded${b.isCustom ? ' · custom' : ''}</span>
            <div class="row row-tight" style="margin-top:.4rem">
              <button type="button" class="btn btn-xs btn-ghost" data-edit="${esc(b.key)}">Edit</button>
              ${b.isCustom ? `<button type="button" class="btn btn-xs btn-danger" data-delete="${esc(b.key)}">Delete</button>` : ''}
            </div>
          </div>`).join('')}
      </div>`;

    panel.querySelector('[data-new]').addEventListener('click', () => openBadgeForm(null, load));
    delegate(panel, 'click', '[data-edit]', (_event, node) => {
      openBadgeForm(badges.find((b) => b.key === node.dataset.edit), load);
    });
    delegate(panel, 'click', '[data-delete]', async (_event, node) => {
      const sure = await confirmDialog({ title: 'Delete this badge?', message: 'Anybody who earned it loses it.', confirmText: 'Delete', danger: true });
      if (!sure) return;
      try {
        await api.admin.deleteBadge(node.dataset.delete);
        toast('Badge deleted.', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}

function openBadgeForm(badge, onSaved) {
  const editing = !!badge;
  modal({
    title: editing ? `Edit ${badge.name}` : 'New badge',
    body: `
      ${editing ? '' : `<div class="field"><label>Key</label>
        <input class="input" data-key placeholder="python_champion">
        <span class="hint">Lower case, no spaces. It never changes.</span></div>`}
      <div class="field"><label>Name</label><input class="input" data-name value="${esc(badge?.name || '')}"></div>
      <div class="field"><label>Description</label>
        <textarea class="textarea" data-description rows="2">${esc(badge?.description || '')}</textarea></div>
      <div class="field"><label>Icon</label>
        <select class="select" data-icon>
          ${['award', 'star', 'trophy', 'zap', 'fire', 'book', 'target', 'users', 'code'].map((i) => `
            <option value="${i}" ${badge?.icon === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select></div>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>${editing ? 'Save' : 'Create badge'}</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const payload = {
          name: root.querySelector('[data-name]').value.trim(),
          description: root.querySelector('[data-description]').value.trim(),
          icon: root.querySelector('[data-icon]').value
        };
        if (!editing) payload.key = root.querySelector('[data-key]').value.trim();
        await withBusy(event.currentTarget, async () => {
          try {
            if (editing) await api.admin.updateBadge(badge.key, payload);
            else await api.admin.createBadge(payload);
            close();
            toast('Badge saved.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
async function announcementsSection(panel) {
  await load();

  async function load() {
    const data = await api.announcements.list('');
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:1rem">
        <p class="muted small" style="margin:0">${plural(data.announcements.length, 'announcement')}.</p>
        <button type="button" class="btn btn-primary btn-sm" data-new>${icon('plus', 15)} New announcement</button>
      </div>
      ${data.announcements.length ? `
        <div class="card"><div class="list">
          ${data.announcements.map((a) => `
            <div class="list-item">
              <div class="meta">
                <div class="title">${a.pinned ? `${icon('pin', 12)} ` : ''}${esc(a.title)}</div>
                <div class="sub">${esc(a.priority)} · ${esc(a.audience)} · ${timeAgo(a.createdAt)}</div>
              </div>
              <button type="button" class="btn btn-xs btn-ghost" data-edit="${a.id}">Edit</button>
              <button type="button" class="btn btn-xs btn-danger" data-delete="${a.id}">Delete</button>
            </div>`).join('')}
        </div></div>`
    : emptyState({ iconName: 'megaphone', title: 'Nothing announced yet' })}`;

    panel.querySelector('[data-new]').addEventListener('click', () => openAnnouncementForm(null, load));
    delegate(panel, 'click', '[data-edit]', async (_event, node) => {
      const { announcement } = await api.announcements.one(Number(node.dataset.edit));
      openAnnouncementForm(announcement, load);
    });
    delegate(panel, 'click', '[data-delete]', async (_event, node) => {
      const sure = await confirmDialog({ title: 'Delete this announcement?', confirmText: 'Delete', danger: true });
      if (!sure) return;
      await api.announcements.remove(Number(node.dataset.delete));
      toast('Deleted.', 'success');
      load();
    });
  }
}

// ---------------------------------------------------------------------------
// Analytics (section 51)
// ---------------------------------------------------------------------------
async function analyticsSection(panel) {
  const data = await api.admin.analytics();
  const peak = Math.max(1, ...data.registrations.map((r) => r.count));

  panel.innerHTML = `
    <div class="grid grid-4">
      ${statTile({ label: 'Active today', value: data.activeUsers.daily, iconName: 'zap', tone: 'accent' })}
      ${statTile({ label: 'Active this week', value: data.activeUsers.weekly, iconName: 'users' })}
      ${statTile({ label: 'Active this month', value: data.activeUsers.monthly, iconName: 'calendar' })}
      ${statTile({ label: 'Average accuracy', value: `${data.averageAccuracy}%`, iconName: 'chart', tone: data.averageAccuracy >= 70 ? 'success' : '' })}
      ${statTile({ label: 'Lessons completed', value: data.totals.lessonsCompleted, iconName: 'book' })}
      ${statTile({ label: 'Questions answered', value: data.totals.questionsAnswered, iconName: 'target' })}
      ${statTile({ label: 'Messages sent', value: data.totals.messagesSent, iconName: 'message' })}
      ${statTile({ label: 'Active conversations', value: data.totals.activeConversations, iconName: 'send' })}
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header"><span class="card-title-icon">${icon('chart', 17)}</span><h3>New accounts, last 30 days</h3></div>
      ${data.registrations.length ? `
        <div class="spark-row">
          ${data.registrations.map((r) => `
            <div class="spark-bar" title="${esc(r.day)}: ${r.count}">
              <span style="height:${Math.round((r.count / peak) * 100)}%"></span>
            </div>`).join('')}
        </div>
        <div class="row" style="justify-content:space-between" class="small faint">
          <span class="tiny faint">${esc(data.registrations[0]?.day || '')}</span>
          <span class="tiny faint">${esc(data.registrations[data.registrations.length - 1]?.day || '')}</span>
        </div>` : '<p class="small faint center">Nobody has joined in the last 30 days.</p>'}
    </div>

    <div class="grid grid-2" style="margin-top:1.25rem">
      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('book', 17)}</span><h3>Most studied subjects</h3></div>
        ${data.popularSubjects.length ? `<div class="list">
          ${data.popularSubjects.map((s) => `
            <div class="list-item"><div class="meta"><div class="title">${esc(s.name)}</div></div>
            <span class="badge">${s.opens} opens</span></div>`).join('')}
        </div>` : '<p class="small faint center">Nothing studied yet.</p>'}
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('warning', 17)}</span><h3>Hardest topics</h3></div>
        ${data.hardestTopics.length ? `<div class="list">
          ${data.hardestTopics.map((t) => `
            <div class="list-item">
              <div class="meta">
                <div class="title">${esc(t.name)}</div>
                <div class="sub">${esc(t.subject_name)} · ${t.answered} attempts</div>
              </div>
              <span class="badge ${t.accuracy < 50 ? 'badge-danger' : 'badge-warning'}">${t.accuracy}%</span>
            </div>`).join('')}
        </div>` : '<p class="small faint center">Not enough attempts yet.</p>'}
      </div>
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header"><span class="card-title-icon">${icon('trophy', 17)}</span><h3>Most active learners</h3></div>
      ${data.mostActive.length ? `<div class="list">
        ${data.mostActive.map((m) => `
          <a class="list-item" href="#/profile/${esc(m.user?.username || '')}">
            ${avatar(m.user, 'xs')}
            <div class="meta"><div class="title">${esc(m.user?.displayName || 'Unknown')}</div></div>
            <span class="badge badge-accent">${m.questionsAnswered} questions</span>
          </a>`).join('')}
      </div>` : '<p class="small faint center">Nobody has answered anything yet.</p>'}
    </div>`;
}

// ---------------------------------------------------------------------------
// Activity log (section 47)
// ---------------------------------------------------------------------------
async function activitySection(panel) {
  let search = '';
  let offset = 0;

  panel.innerHTML = `
    <div class="admin-filters">
      <input class="input" data-search placeholder="Search the log...">
    </div>
    <div id="log"><div class="spinner spinner-center"></div></div>`;

  const box = panel.querySelector('#log');

  async function load() {
    const data = await api.admin.logs(`?limit=50&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    box.innerHTML = `
      <p class="small faint">${plural(data.total, 'entry', 'entries')} in total.</p>
      <div class="card"><div class="list">${data.logs.map(logRow).join('')}</div></div>
      <div class="row" style="justify-content:center;gap:.6rem;margin-top:1rem">
        <button type="button" class="btn btn-sm btn-ghost" data-page="prev" ${offset === 0 ? 'disabled' : ''}>Newer</button>
        <button type="button" class="btn btn-sm btn-ghost" data-page="next" ${data.logs.length < 50 ? 'disabled' : ''}>Older</button>
      </div>`;
  }

  panel.querySelector('[data-search]').addEventListener('input', debounce((event) => {
    search = event.target.value.trim();
    offset = 0;
    load();
  }, 300));

  delegate(panel, 'click', '[data-page]', (_event, node) => {
    offset = node.dataset.page === 'next' ? offset + 50 : Math.max(0, offset - 50);
    load();
  });

  await load();
}

// ---------------------------------------------------------------------------
// Roles and permissions (section 48)
// ---------------------------------------------------------------------------
async function permissionsSection(panel) {
  const { roles, permissions } = await api.admin.roles();

  panel.innerHTML = `
    <div class="callout callout-info">
      <span class="callout-icon">${icon('info', 16)}</span>
      <div>
        <strong>How this works</strong>
        <p>
          Each role carries a set of permissions. Every request is checked against them on the
          server, so nobody can gain a permission by changing what the browser sends.
          Individual people can be given or refused a single permission from the Users screen.
        </p>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1.25rem">
      ${roles.map((role) => `
        <div class="card">
          <div class="card-header">
            <span class="card-title-icon">${icon(role.key === 'super_admin' ? 'crown' : 'lock', 17)}</span>
            <h3>${esc(role.name)}</h3>
            <span class="badge">${plural(role.memberCount, 'member')}</span>
          </div>
          <p class="small muted">${esc(role.description)}</p>
          <p class="small faint">${role.permissions.length} of ${permissions.length} permissions</p>
          <div class="chip-row">
            ${role.permissions.slice(0, 40).map((p) => `<span class="badge">${esc(p)}</span>`).join('')}
            ${role.permissions.length > 40 ? `<span class="badge">+${role.permissions.length - 40} more</span>` : ''}
          </div>
        </div>`).join('')}
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header"><span class="card-title-icon">${icon('grid', 17)}</span><h3>Every permission</h3></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Permission</th><th>What it allows</th>${roles.map((r) => `<th>${esc(r.name)}</th>`).join('')}</tr></thead>
          <tbody>
            ${permissions.map((p) => `
              <tr>
                <td class="small bold">${esc(p.key)}</td>
                <td class="small faint">${esc(p.description)}</td>
                ${roles.map((r) => `<td class="center">${r.permissions.includes(p.key)
    ? `<span style="color:var(--success)">${icon('check', 14)}</span>`
    : '<span class="faint">-</span>'}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Site settings (section 49)
// ---------------------------------------------------------------------------
async function settingsSection(panel) {
  const { settings } = await api.admin.settings();

  const text = (key, label, hint = '') => `
    <div class="field"><label>${esc(label)}</label>
      <input class="input" data-setting="${key}" value="${esc(settings[key] || '')}">
      ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
  const number = (key, label) => `
    <div class="field"><label>${esc(label)}</label>
      <input class="input" type="number" data-setting="${key}" value="${esc(settings[key] || '0')}"></div>`;
  const toggle = (key, label) => `
    <label class="check"><input type="checkbox" data-setting="${key}" ${settings[key] === 'true' ? 'checked' : ''}>
      <span>${esc(label)}</span></label>`;

  panel.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('settings', 17)}</span><h3>Site</h3></div>
      ${text('site_name', 'Site name')}
      ${text('site_tagline', 'Tagline', 'Shown under the name in the sidebar.')}
      ${text('site_description', 'Description')}
      <div class="field"><label>Welcome message on the sign-in screen</label>
        <textarea class="textarea" data-setting="welcome_message">${esc(settings.welcome_message || '')}</textarea></div>
      ${toggle('maintenance_mode', 'Maintenance mode - close the site to everybody except administrators')}
      ${text('maintenance_message', 'Message shown while closed')}
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('user', 17)}</span><h3>Accounts</h3></div>
      <div class="field"><label>Registration</label>
        <select class="select" data-setting="registration_mode">
          <option value="open" ${settings.registration_mode === 'open' ? 'selected' : ''}>Anybody can sign up</option>
          <option value="invite" ${settings.registration_mode === 'invite' ? 'selected' : ''}>Invitation code required</option>
          <option value="closed" ${settings.registration_mode === 'closed' ? 'selected' : ''}>Closed</option>
        </select></div>
      ${toggle('require_email_verification', 'Require email verification')}
      ${toggle('allow_username_change', 'Let people change their own username')}
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('message', 17)}</span><h3>Messaging</h3></div>
      ${toggle('messaging_enabled', 'Direct messaging is switched on')}
      ${toggle('message_editing', 'People may edit their own messages')}
      ${toggle('message_delete_for_everyone', 'People may delete a message for everyone')}
      ${toggle('message_reactions', 'Reactions are allowed')}
      ${toggle('message_type_code', 'Code snippets are allowed')}
      ${toggle('message_type_images', 'Pictures are allowed')}
      ${toggle('message_type_files', 'Files are allowed')}
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('zap', 17)}</span><h3>Learning and XP</h3></div>
      ${number('practice_question_count', 'Questions per practice set')}
      ${toggle('leaderboards_enabled', 'Leaderboards are visible')}
      <div class="grid grid-3">
        ${number('xp_lesson_complete', 'XP for finishing a lesson')}
        ${number('xp_correct_answer', 'XP for a correct answer')}
        ${number('xp_coding_challenge', 'XP for a coding challenge')}
      </div>
      <p class="small faint">A lesson or challenge with its own XP value uses that instead.</p>
    </div>

    <button class="btn btn-primary btn-lg" id="save-settings">${icon('check', 16)} Save all settings</button>`;

  panel.querySelector('#save-settings').addEventListener('click', async (event) => {
    const payload = {};
    for (const field of panel.querySelectorAll('[data-setting]')) {
      payload[field.dataset.setting] = field.type === 'checkbox' ? String(field.checked) : field.value;
    }
    await withBusy(event.currentTarget, async () => {
      try {
        await api.admin.updateSettings(payload);
        store.config.siteName = payload.site_name || store.config.siteName;
        store.config.tagline = payload.site_tagline ?? store.config.tagline;
        toast('Settings saved.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }, 'Saving...');
  });
}
