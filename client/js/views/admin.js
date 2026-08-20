// ==========================================================
// The administration dashboard.
// Every section checks a permission before it is shown, and the
// server checks again on every request.
// ==========================================================
import { esc, timeAgo, formatDateTime, plural, debounce } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, roleBadge, priorityBadge } from '../components/common.js';
import { toast, modal, confirmDialog, contextMenu, promptDialog } from '../lib/ui.js';
import { navigate } from '../lib/router.js';
import { openHomeworkForm } from './homework.js';
import { openAnnouncementForm } from './announcements.js';

const SECTIONS = [
  { key: 'overview',      label: 'Overview',      icon: 'chart',     permission: 'admin.access' },
  { key: 'users',         label: 'Members',       icon: 'users',     permission: 'users.view' },
  { key: 'clubs',         label: 'Clubs',         icon: 'flag',      permission: 'clubs.approve' },
  { key: 'homework',      label: 'Homework',      icon: 'book',      permission: 'homework.create' },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone', permission: 'announcements.create' },
  { key: 'games',         label: 'Games',         icon: 'game',      permission: 'games.manage' },
  { key: 'reports',       label: 'Moderation',    icon: 'shield',    permission: 'reports.view' },
  { key: 'invitations',   label: 'Invitations',   icon: 'ticket',    permission: 'users.invite' },
  { key: 'roles',         label: 'Roles',         icon: 'lock',      permission: 'admin.access' },
  { key: 'settings',      label: 'Settings',      icon: 'settings',  permission: 'settings.manage' },
  { key: 'logs',          label: 'Activity log',  icon: 'clock',     permission: 'logs.view' }
];

export default async function admin({ mount, params }) {
  if (!can('admin.access')) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'lock', title: 'Administrators only',
      text: 'You do not have permission to open this area.',
      action: '<a class="btn btn-primary" href="#/">Back to the home page</a>'
    })}</div>`;
    return;
  }

  const available = SECTIONS.filter((s) => can(s.permission));
  const section = available.some((s) => s.key === params.section) ? params.section : 'overview';
  setPageTitle('Admin Dashboard');

  mount.innerHTML = `
    <div class="page page-wide">
      <div class="row" style="margin-bottom:1rem">
        <span class="card-title-icon" style="background:var(--danger-soft);color:var(--danger)">${icon('crown', 18)}</span>
        <div>
          <h1 style="margin:0">Admin Dashboard</h1>
          <p class="muted small" style="margin:0">Signed in as ${esc(store.user.displayName)} (${esc(store.user.roleName)}).</p>
        </div>
      </div>

      <div class="admin-tabs" id="admin-tabs">
        ${available.map((s) => `
          <a href="#/admin/${s.key}" class="chip ${s.key === section ? 'active' : ''}">${icon(s.icon, 14)} ${esc(s.label)}</a>`).join('')}
      </div>

      <div id="admin-panel" style="margin-top:1.25rem"><div class="spinner spinner-center"></div></div>
    </div>`;

  const panel = mount.querySelector('#admin-panel');
  const renderers = {
    overview: overviewSection, users: usersSection, clubs: clubsSection,
    homework: homeworkSection, announcements: announcementsSection, games: gamesSection,
    reports: reportsSection, invitations: invitationsSection, roles: rolesSection,
    settings: settingsSection, logs: logsSection
  };

  try {
    await renderers[section](panel);
  } catch (err) {
    panel.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
async function overviewSection(panel) {
  const data = await api.admin.stats();
  const s = data.stats;
  const tiles = [
    { label: 'Members', value: s.totalStudents, icon: 'users', link: '#/admin/users' },
    { label: 'Online now', value: s.onlineStudents, icon: 'zap', tone: 'success' },
    { label: 'Posts', value: s.totalPosts, icon: 'feed' },
    { label: 'Messages', value: s.totalMessages, icon: 'message' },
    { label: 'Clubs', value: s.totalClubs, icon: 'flag', link: '#/admin/clubs' },
    { label: 'Games played', value: s.totalGamesPlayed, icon: 'game' },
    { label: 'Homework set', value: s.homeworkAssignments, icon: 'book', link: '#/admin/homework' },
    { label: 'Announcements', value: s.announcements, icon: 'megaphone', link: '#/admin/announcements' },
    { label: 'Pending clubs', value: s.pendingClubRequests, icon: 'clock', tone: s.pendingClubRequests ? 'warning' : '', link: '#/admin/clubs' },
    { label: 'Open reports', value: s.pendingReports, icon: 'shield', tone: s.pendingReports ? 'danger' : '', link: '#/admin/reports' },
    { label: 'Suspended', value: s.suspended, icon: 'block', tone: s.suspended ? 'warning' : '' },
    { label: 'Open invitations', value: s.openInvitations, icon: 'ticket', link: '#/admin/invitations' }
  ];

  panel.innerHTML = `
    <div class="grid grid-4">
      ${tiles.map((t) => {
    const inner = `
        <div class="stat-icon" ${t.tone ? `style="background:var(--${t.tone}-soft);color:var(--${t.tone})"` : ''}>${icon(t.icon, 19)}</div>
        <div class="stat-body"><div class="stat-value">${t.value}</div><div class="stat-label">${esc(t.label)}</div></div>`;
    return t.link
      ? `<a class="stat card-hover" href="${t.link}" style="color:inherit;text-decoration:none">${inner}</a>`
      : `<div class="stat">${inner}</div>`;
  }).join('')}
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header">
        <span class="card-title-icon">${icon('clock', 17)}</span>
        <h3>Recent administrator activity</h3>
        ${can('logs.view') ? '<a class="btn btn-sm btn-ghost" href="#/admin/logs">Full log</a>' : ''}
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
  return String(action)
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/^(\w)/, (m) => m.toLowerCase());
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
async function usersSection(panel) {
  let search = '';
  let status = '';

  panel.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div class="row">
        <div class="topbar-search" style="max-width:none;flex:1 1 220px">
          ${icon('search', 16)}
          <input class="input" id="user-search" placeholder="Search by name, username or email..." style="padding-left:2.2rem">
        </div>
        <select class="select" id="status-filter" style="width:auto;min-width:150px">
          <option value="">All accounts</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        ${can('users.edit') ? `<button class="btn btn-primary" id="add-user">${icon('plus', 15)} Add member</button>` : ''}
      </div>
    </div>
    <div id="user-table"><div class="spinner spinner-center"></div></div>`;

  async function load() {
    const holder = panel.querySelector('#user-table');
    const parts = [];
    if (search) parts.push(`search=${encodeURIComponent(search)}`);
    if (status) parts.push(`status=${status}`);
    const data = await api.admin.users(parts.length ? `?${parts.join('&')}` : '');

    holder.innerHTML = `
      <div class="card card-flush">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Member</th><th>Role</th><th>Status</th><th>XP</th><th>Last seen</th><th style="width:52px"></th></tr>
            </thead>
            <tbody>
              ${data.users.map((u) => `
                <tr data-user="${u.id}">
                  <td>
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      ${avatar(u, 'sm', true)}
                      <div style="min-width:0">
                        <div class="bold truncate">${esc(u.displayName)}</div>
                        <div class="tiny faint truncate">@${esc(u.username)}${u.email ? ` - ${esc(u.email)}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>${roleBadge(u) || '<span class="badge">Student</span>'}</td>
                  <td>
                    <span class="badge ${u.status === 'active' ? 'badge-success' : (u.status === 'suspended' ? 'badge-warning' : 'badge-danger')}">${esc(u.status)}</span>
                    ${!u.canPost ? '<span class="badge badge-danger" title="Posting paused">No posts</span>' : ''}
                    ${!u.canMessage ? '<span class="badge badge-danger" title="Messaging paused">No messages</span>' : ''}
                  </td>
                  <td class="nowrap">${u.xp} <span class="tiny faint">Lv ${u.level}</span></td>
                  <td class="tiny faint nowrap">${u.lastSeen ? timeAgo(u.lastSeen) : 'never'}</td>
                  <td><button class="icon-button" data-user-menu="${u.id}" aria-label="Manage">${icon('more', 17)}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <p class="tiny faint" style="margin-top:.6rem">${plural(data.total, 'member')} found.</p>`;
  }

  panel.querySelector('#user-search').addEventListener('input', debounce((event) => {
    search = event.target.value.trim();
    load();
  }, 250));
  panel.querySelector('#status-filter').addEventListener('change', (event) => {
    status = event.target.value;
    load();
  });
  panel.querySelector('#add-user')?.addEventListener('click', () => openAddUser(load));

  panel.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-user-menu]');
    if (!button) return;
    await handleUserMenu(button, load);
  });

  await load();
}

async function handleUserMenu(button, reload) {
  const id = Number(button.dataset.userMenu);
  const row = button.closest('tr');
  const name = row.querySelector('.bold').textContent;
  const suspended = row.textContent.includes('suspended');

  const items = [
    { label: 'View profile', action: 'profile', icon: 'user' },
    { label: 'Account details', action: 'details', icon: 'info' },
    ...(can('users.edit') ? [{ label: 'Edit account', action: 'edit', icon: 'edit' }] : []),
    ...(can('users.roles') ? [{ label: 'Change role', action: 'role', icon: 'shield' }] : []),
    ...(can('users.restrict') ? [{ label: 'Restrict posting or messaging', action: 'restrict', icon: 'block' }] : []),
    ...(can('users.xp') ? [{ label: 'Adjust XP', action: 'xp', icon: 'zap' }, { label: 'Give a badge', action: 'badge', icon: 'award' }] : []),
    ...(can('users.edit') ? [{ label: 'Reset password', action: 'password', icon: 'lock' }] : []),
    '-',
    ...(can('users.suspend') ? [{ label: suspended ? 'Unsuspend account' : 'Suspend account', action: 'suspend', icon: 'block', danger: !suspended }] : []),
    ...(can('users.delete') ? [{ label: 'Delete account', action: 'delete', icon: 'trash', danger: true }] : [])
  ];

  const action = await contextMenu(button, items);
  if (!action) return;

  if (action === 'profile') {
    const { user } = await api.admin.user(id);
    return navigate(`/profile/${user.username}`);
  }

  if (action === 'details') return openUserDetails(id);

  if (action === 'edit') {
    const { user } = await api.admin.user(id);
    return openEditUser(user, reload);
  }

  if (action === 'role') {
    const { roles } = await api.admin.roles();
    return openRolePicker(id, name, roles, reload);
  }

  if (action === 'restrict') return openRestrict(id, name, reload);

  if (action === 'xp') {
    const value = await promptDialog({
      title: `Adjust XP for ${name}`,
      label: 'How much XP? Use a minus sign to take XP away.',
      placeholder: '50 or -50'
    });
    if (!value) return;
    try {
      const result = await api.admin.adjustXp(id, Number(value));
      toast(`XP is now ${result.xp}.`, 'success');
      reload();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  if (action === 'badge') {
    const { badges } = await api.admin.badges();
    const choice = await contextMenu(button, badges.map((b) => ({ label: b.name, action: b.key, icon: 'award' })));
    if (!choice) return;
    try {
      await api.admin.setBadge(id, choice, false);
      toast('Badge awarded.', 'success');
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  if (action === 'password') {
    const password = await promptDialog({
      title: `Reset the password for ${name}`,
      label: 'Temporary password (at least 8 characters)',
      placeholder: 'They will be asked to change it when they sign in.'
    });
    if (!password) return;
    try {
      await api.admin.resetPassword(id, password);
      toast('Password reset. Give the new password to the member in person.', 'success');
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  if (action === 'suspend') {
    if (suspended) {
      try { await api.admin.suspend(id, false, ''); toast('Account reactivated.', 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const reason = await promptDialog({
      title: `Suspend ${name}?`,
      label: 'Reason (the member will see this when they try to sign in)',
      placeholder: 'Repeated bullying after a warning.',
      confirmText: 'Suspend'
    });
    if (!reason) return;
    try { await api.admin.suspend(id, true, reason); toast('Account suspended.', 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
    return;
  }

  if (action === 'delete') {
    const yes = await confirmDialog({
      title: `Delete ${name}?`,
      message: 'The account is closed and can no longer sign in. Their posts stay, marked as from a deleted member.',
      confirmText: 'Delete account',
      danger: true
    });
    if (!yes) return;
    try { await api.admin.deleteUser(id, false); toast('Account deleted.', 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
  }
}

async function openUserDetails(id) {
  const data = await api.admin.user(id);
  modal({
    title: data.user.displayName,
    size: 'modal-lg',
    body: `
      <div class="row" style="margin-bottom:1rem">
        ${avatar(data.user, 'lg', true)}
        <div>
          <div class="bold">${esc(data.user.displayName)}</div>
          <div class="tiny faint">@${esc(data.user.username)} - ${esc(data.user.roleName)}</div>
          <div class="tiny faint">Joined ${formatDateTime(data.user.joinedAt)}</div>
        </div>
      </div>
      <div class="grid grid-3" style="margin-bottom:1rem">
        ${Object.entries(data.counts).map(([key, value]) => `
          <div class="mini-stat"><span class="bold">${value}</span><span class="tiny faint">${esc(key.replace(/([A-Z])/g, ' $1'))}</span></div>`).join('')}
      </div>
      <div class="section-title">Recent activity</div>
      ${data.activity.length
    ? `<div class="list">${data.activity.map((a) => `
        <div class="list-item">
          <div class="meta">
            <div class="title">${esc(readableAction(a.action))}</div>
            <div class="sub">${esc(a.details || '')} - ${timeAgo(a.createdAt)}</div>
          </div>
        </div>`).join('')}</div>`
    : '<p class="small faint">No recorded activity.</p>'}`,
    footer: '<button class="btn" data-close>Close</button>'
  });
}

function openAddUser(onDone) {
  modal({
    title: 'Add a member',
    body: `
      <p class="small muted">Use this when a student cannot use an invitation code. They will be asked to
      change the password the first time they sign in.</p>
      <form id="add-user-form">
        <div class="field"><label>Full name</label><input class="input" name="displayName" required maxlength="40"></div>
        <div class="field"><label>Username</label><input class="input" name="username" required maxlength="20" placeholder="alex"></div>
        <div class="field"><label>Email (optional)</label><input class="input" name="email" type="email" maxlength="120"></div>
        <div class="field">
          <label>Temporary password</label>
          <input class="input" name="password" required minlength="8" value="Grade8Start!">
        </div>
        ${can('users.roles') ? `
        <div class="field">
          <label>Role</label>
          <select class="select" name="role">
            <option value="student">Student</option>
            <option value="club_admin">Club Admin</option>
            <option value="moderator">Moderator</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>` : ''}
      </form>`,
    footer: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="save-user">Create account</button>',
    onOpen: ({ root, close }) => {
      root.querySelector('#save-user').addEventListener('click', async (event) => {
        const form = root.querySelector('#add-user-form');
        if (!form.reportValidity()) return;
        event.currentTarget.disabled = true;
        try {
          await api.admin.createUser(Object.fromEntries(new FormData(form)));
          close();
          toast('Account created.', 'success');
          onDone();
        } catch (err) {
          toast(err.message, 'error');
          event.currentTarget.disabled = false;
        }
      });
    }
  });
}

function openEditUser(user, onDone) {
  modal({
    title: `Edit ${user.displayName}`,
    body: `
      <form id="edit-user-form">
        <div class="field"><label>Display name</label><input class="input" name="displayName" value="${esc(user.displayName)}" maxlength="40"></div>
        <div class="field"><label>Email</label><input class="input" name="email" type="email" value="${esc(user.email || '')}" maxlength="120"></div>
        <div class="field"><label>Bio</label><textarea class="textarea" name="bio" maxlength="400">${esc(user.bio || '')}</textarea></div>
      </form>`,
    footer: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="save-edit">Save</button>',
    onOpen: ({ root, close }) => {
      root.querySelector('#save-edit').addEventListener('click', async () => {
        try {
          await api.admin.updateUser(user.id, Object.fromEntries(new FormData(root.querySelector('#edit-user-form'))));
          close();
          toast('Account updated.', 'success');
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}

function openRolePicker(id, name, roles, onDone) {
  modal({
    title: `Change the role for ${name}`,
    body: `
      <p class="small muted">A role decides what somebody may do. The server checks this on every request.</p>
      <div class="list">
        ${roles.map((role) => `
          <button class="list-item" data-role="${role.key}" style="border:0;background:none;width:100%;cursor:pointer;text-align:left">
            <span class="card-title-icon">${icon('shield', 16)}</span>
            <span class="meta">
              <span class="title">${esc(role.name)}</span>
              <span class="sub" style="white-space:normal">${esc(role.description)}</span>
              <span class="tiny faint">${plural(role.permissions.length, 'permission')}</span>
            </span>
          </button>`).join('')}
      </div>`,
    footer: '<button class="btn" data-close>Cancel</button>',
    onOpen: ({ root, close }) => {
      root.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-role]');
        if (!button) return;
        try {
          await api.admin.setRole(id, button.dataset.role);
          close();
          toast('Role updated.', 'success');
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}

function openRestrict(id, name, onDone) {
  modal({
    title: `Restrictions for ${name}`,
    body: `
      <p class="small muted">Use this instead of a suspension when somebody needs a short break from posting or messaging.</p>
      <label class="switch"><span class="switch-label">Allow posting<small>Feed posts and comments.</small></span>
        <input type="checkbox" id="allow-post" checked></label>
      <label class="switch"><span class="switch-label">Allow messaging<small>Private and club messages.</small></span>
        <input type="checkbox" id="allow-message" checked></label>`,
    footer: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="save-restrict">Apply</button>',
    onOpen: ({ root, close }) => {
      root.querySelector('#save-restrict').addEventListener('click', async () => {
        try {
          await api.admin.restrict(id, {
            canPost: root.querySelector('#allow-post').checked,
            canMessage: root.querySelector('#allow-message').checked
          });
          close();
          toast('Restrictions updated.', 'success');
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------
async function clubsSection(panel) {
  async function load() {
    const { clubs } = await api.admin.clubs();
    const pending = clubs.filter((c) => c.status === 'pending');

    panel.innerHTML = `
      ${pending.length ? `
        <div class="card" style="border-color:var(--warning);margin-bottom:1rem">
          <div class="card-header">
            <span class="card-title-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('clock', 17)}</span>
            <h3>Waiting for approval (${pending.length})</h3>
          </div>
          <div class="list">
            ${pending.map((c) => `
              <div class="list-item">
                <span class="club-logo club-logo-sm">${esc(c.name.slice(0, 2).toUpperCase())}</span>
                <div class="meta">
                  <div class="title">${esc(c.name)}</div>
                  <div class="sub" style="white-space:normal">${esc(c.description || 'No description')} - asked by ${esc(c.owner?.displayName || '')}</div>
                </div>
                <div class="row row-tight">
                  <button class="btn btn-sm btn-success" data-approve="${c.id}">Approve</button>
                  <button class="btn btn-sm btn-danger" data-reject="${c.id}">Reject</button>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <div class="card card-flush">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Club</th><th>Owner</th><th>Members</th><th>Status</th><th style="width:52px"></th></tr></thead>
            <tbody>
              ${clubs.map((c) => `
                <tr>
                  <td>
                    <a href="#/clubs/${c.id}" style="color:inherit">
                      <div class="bold">${esc(c.name)}</div>
                      <div class="tiny faint">@${esc(c.handle)} - ${esc(c.category)}</div>
                    </a>
                  </td>
                  <td class="truncate">${esc(c.owner?.displayName || '')}</td>
                  <td>${c.memberCount}</td>
                  <td><span class="badge ${c.status === 'approved' ? 'badge-success' : (c.status === 'pending' ? 'badge-warning' : 'badge-danger')}">${esc(c.status)}</span></td>
                  <td><button class="icon-button" data-club-menu="${c.id}" data-status="${c.status}" aria-label="Manage">${icon('more', 17)}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  panel.addEventListener('click', async (event) => {
    const approve = event.target.closest('[data-approve]');
    if (approve) {
      try { await api.admin.setClubStatus(Number(approve.dataset.approve), 'approved', ''); toast('Club approved.', 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const reject = event.target.closest('[data-reject]');
    if (reject) {
      const note = await promptDialog({ title: 'Reject this club', label: 'Reason for the owner', confirmText: 'Reject' });
      if (!note) return;
      try { await api.admin.setClubStatus(Number(reject.dataset.reject), 'rejected', note); toast('Club rejected.', 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const menu = event.target.closest('[data-club-menu]');
    if (menu) {
      const id = Number(menu.dataset.clubMenu);
      const status = menu.dataset.status;
      const action = await contextMenu(menu, [
        { label: 'Open the club', action: 'open', icon: 'users' },
        ...(status !== 'approved' ? [{ label: 'Approve', action: 'approved', icon: 'check' }] : []),
        ...(status !== 'suspended' ? [{ label: 'Suspend', action: 'suspended', icon: 'block', danger: true }] : []),
        ...(can('clubs.delete') ? ['-', { label: 'Delete club', action: 'delete', icon: 'trash', danger: true }] : [])
      ]);

      if (action === 'open') return navigate(`/clubs/${id}`);
      if (['approved', 'suspended'].includes(action)) {
        try { await api.admin.setClubStatus(id, action, ''); toast(`Club ${action}.`, 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
      }
      if (action === 'delete') {
        const yes = await confirmDialog({ title: 'Delete this club?', message: 'Every post, event and chat message will be removed.', confirmText: 'Delete', danger: true });
        if (!yes) return;
        try { await api.admin.deleteClub(id); toast('Club deleted.', 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
      }
    }
  });

  await load();
}

// ---------------------------------------------------------------------------
// Homework and announcements
// ---------------------------------------------------------------------------
async function homeworkSection(panel) {
  async function load() {
    const data = await api.homework.list('?filter=all&limit=100');
    panel.innerHTML = `
      <div class="row" style="margin-bottom:1rem">
        <h3 style="margin:0">All homework</h3>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="new-hw">${icon('plus', 15)} New homework</button>
      </div>
      <div class="card card-flush">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>Title</th><th>Due</th><th>Priority</th><th style="width:52px"></th></tr></thead>
            <tbody>
              ${data.homework.map((h) => `
                <tr>
                  <td class="nowrap">${esc(h.subject)}</td>
                  <td><a href="#/homework/${h.id}" style="color:inherit" class="bold">${esc(h.title)}</a></td>
                  <td class="nowrap tiny">${esc(String(h.dueDate).slice(0, 10))}</td>
                  <td>${priorityBadge(h.priority)}</td>
                  <td><button class="icon-button" data-hw-menu="${h.id}" aria-label="Manage">${icon('more', 17)}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${data.homework.length ? '' : `<div class="card">${emptyState({ iconName: 'book', title: 'No homework set yet' })}</div>`}`;
  }

  panel.addEventListener('click', async (event) => {
    if (event.target.closest('#new-hw')) return openHomeworkForm(null, load);

    const menu = event.target.closest('[data-hw-menu]');
    if (!menu) return;
    const id = Number(menu.dataset.hwMenu);
    const action = await contextMenu(menu, [
      { label: 'Open', action: 'open', icon: 'eye' },
      { label: 'Edit', action: 'edit', icon: 'edit' },
      { label: 'Send a reminder', action: 'remind', icon: 'megaphone' },
      { label: 'Completion statistics', action: 'stats', icon: 'chart' },
      ...(can('homework.delete') ? ['-', { label: 'Delete', action: 'delete', icon: 'trash', danger: true }] : [])
    ]);

    if (action === 'open') return navigate(`/homework/${id}`);
    if (action === 'edit') {
      const { homework } = await api.homework.one(id);
      return openHomeworkForm(homework, load);
    }
    if (action === 'remind') {
      try {
        const result = await api.homework.remind(id, '');
        toast(`Reminder sent to ${result.remindedCount} students.`, 'success');
      } catch (err) { toast(err.message, 'error'); }
    }
    if (action === 'stats') {
      const { stats } = await api.homework.stats(id);
      modal({
        title: 'Completion statistics',
        body: `
          <div class="level-bar" style="height:10px;margin-bottom:1rem"><span style="width:${stats.percentComplete}%"></span></div>
          <div class="grid grid-3">
            <div class="mini-stat"><span class="bold">${stats.counts.completed}</span><span class="tiny faint">Completed</span></div>
            <div class="mini-stat"><span class="bold">${stats.counts.in_progress}</span><span class="tiny faint">In progress</span></div>
            <div class="mini-stat"><span class="bold">${stats.counts.not_started}</span><span class="tiny faint">Not started</span></div>
          </div>`,
        footer: '<button class="btn" data-close>Close</button>'
      });
    }
    if (action === 'delete') {
      const yes = await confirmDialog({ title: 'Delete this homework?', confirmText: 'Delete', danger: true });
      if (!yes) return;
      try { await api.homework.remove(id); toast('Deleted.', 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
    }
  });

  await load();
}

async function announcementsSection(panel) {
  async function load() {
    const data = await api.announcements.list('?limit=100');
    panel.innerHTML = `
      <div class="row" style="margin-bottom:1rem">
        <h3 style="margin:0">All announcements</h3>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="new-ann">${icon('plus', 15)} New announcement</button>
      </div>
      <div class="card card-flush">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Category</th><th>Priority</th><th>Published</th><th style="width:52px"></th></tr></thead>
            <tbody>
              ${data.announcements.map((a) => `
                <tr>
                  <td>
                    <div class="bold">${a.pinned ? `${icon('pin', 12)} ` : ''}${esc(a.title)}</div>
                    <div class="tiny faint truncate" style="max-width:36ch">${esc(a.message)}</div>
                  </td>
                  <td><span class="badge">${esc(a.category)}</span></td>
                  <td>${priorityBadge(a.priority)}</td>
                  <td class="tiny faint nowrap">${timeAgo(a.publishAt)}</td>
                  <td><button class="icon-button" data-ann-menu="${a.id}" aria-label="Manage">${icon('more', 17)}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  panel.addEventListener('click', async (event) => {
    if (event.target.closest('#new-ann')) return openAnnouncementForm(null, load);

    const menu = event.target.closest('[data-ann-menu]');
    if (!menu) return;
    const id = Number(menu.dataset.annMenu);
    const action = await contextMenu(menu, [
      { label: 'Edit', action: 'edit', icon: 'edit' },
      { label: 'Pin or unpin', action: 'pin', icon: 'pin' },
      ...(can('announcements.delete') ? ['-', { label: 'Delete', action: 'delete', icon: 'trash', danger: true }] : [])
    ]);

    if (action === 'edit') {
      const { announcement } = await api.announcements.one(id);
      return openAnnouncementForm(announcement, load);
    }
    if (action === 'pin') {
      try { const r = await api.announcements.pin(id); toast(r.pinned ? 'Pinned.' : 'Unpinned.', 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
    }
    if (action === 'delete') {
      const yes = await confirmDialog({ title: 'Delete this announcement?', confirmText: 'Delete', danger: true });
      if (!yes) return;
      try { await api.announcements.remove(id); await load(); } catch (err) { toast(err.message, 'error'); }
    }
  });

  await load();
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------
async function gamesSection(panel) {
  async function load() {
    const [data, settings] = await Promise.all([api.games.hub(), api.admin.settings().catch(() => ({ settings: {} }))]);

    panel.innerHTML = `
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header"><span class="card-title-icon">${icon('settings', 17)}</span><h3>Gaming Hub controls</h3></div>
        <label class="switch"><span class="switch-label">Gaming Hub open<small>Turn every game off at once.</small></span>
          <input type="checkbox" data-setting="games_enabled" ${settings.settings?.games_enabled === 'true' ? 'checked' : ''}></label>
        <label class="switch"><span class="switch-label">Multiplayer games<small>Let students challenge each other.</small></span>
          <input type="checkbox" data-setting="multiplayer_enabled" ${settings.settings?.multiplayer_enabled === 'true' ? 'checked' : ''}></label>
        <label class="switch"><span class="switch-label">Leaderboards<small>Hide the leaderboard from everybody.</small></span>
          <input type="checkbox" data-setting="leaderboard_enabled" ${settings.settings?.leaderboard_enabled === 'true' ? 'checked' : ''}></label>
        <div class="divider"></div>
        <div class="row">
          <button class="btn btn-sm btn-primary" id="new-tournament">${icon('trophy', 14)} Create a tournament</button>
          <button class="btn btn-sm btn-danger" id="reset-all">${icon('refresh', 14)} Reset every leaderboard</button>
        </div>
      </div>

      <div class="card card-flush">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Game</th><th>Category</th><th>Enabled</th><th>Multiplayer</th><th style="width:52px"></th></tr></thead>
            <tbody>
              ${data.games.map((g) => `
                <tr>
                  <td><div class="bold">${esc(g.name)}</div><div class="tiny faint truncate" style="max-width:34ch">${esc(g.description)}</div></td>
                  <td class="nowrap">${esc(g.category)}</td>
                  <td><label class="switch" style="padding:0"><input type="checkbox" data-game="${esc(g.key)}" data-field="enabled" ${g.enabled ? 'checked' : ''}></label></td>
                  <td><label class="switch" style="padding:0"><input type="checkbox" data-game="${esc(g.key)}" data-field="multiplayer" ${g.multiplayer ? 'checked' : ''}></label></td>
                  <td><button class="icon-button" data-reset-game="${esc(g.key)}" title="Reset this leaderboard">${icon('refresh', 16)}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  panel.addEventListener('change', async (event) => {
    const gameToggle = event.target.closest('[data-game]');
    if (gameToggle) {
      try {
        await api.games.setGame(gameToggle.dataset.game, { [gameToggle.dataset.field]: gameToggle.checked });
        toast('Saved.', 'success');
      } catch (err) { toast(err.message, 'error'); gameToggle.checked = !gameToggle.checked; }
      return;
    }

    const setting = event.target.closest('[data-setting]');
    if (setting) {
      try {
        await api.admin.updateSettings({ [setting.dataset.setting]: setting.checked ? 'true' : 'false' });
        toast('Saved.', 'success');
      } catch (err) { toast(err.message, 'error'); setting.checked = !setting.checked; }
    }
  });

  panel.addEventListener('click', async (event) => {
    const reset = event.target.closest('[data-reset-game]');
    if (reset) {
      const yes = await confirmDialog({ title: 'Reset this leaderboard?', message: 'Every score for this game is removed. XP already earned stays.', confirmText: 'Reset', danger: true });
      if (!yes) return;
      try { await api.games.resetLeaderboard(reset.dataset.resetGame); toast('Leaderboard reset.', 'success'); } catch (err) { toast(err.message, 'error'); }
      return;
    }

    if (event.target.closest('#reset-all')) {
      const yes = await confirmDialog({ title: 'Reset every leaderboard?', message: 'All game scores are removed for every game.', confirmText: 'Reset everything', danger: true });
      if (!yes) return;
      try { await api.games.resetLeaderboard('all'); toast('All leaderboards reset.', 'success'); } catch (err) { toast(err.message, 'error'); }
      return;
    }

    if (event.target.closest('#new-tournament')) {
      const { games } = await api.games.hub();
      modal({
        title: 'Create a tournament',
        body: `
          <form id="tournament-form">
            <div class="field"><label>Name</label><input class="input" name="name" required maxlength="80" placeholder="Grade 8 Quiz Cup"></div>
            <div class="field">
              <label>Game</label>
              <select class="select" name="gameKey">
                ${games.map((g) => `<option value="${esc(g.key)}">${esc(g.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Description</label><textarea class="textarea" name="description" maxlength="400"></textarea></div>
            <div class="field">
              <label>Status</label>
              <select class="select" name="status"><option value="open">Open for entries</option><option value="running">Running now</option></select>
            </div>
          </form>`,
        footer: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="save-tournament">Create</button>',
        onOpen: ({ root, close }) => {
          root.querySelector('#save-tournament').addEventListener('click', async () => {
            const form = root.querySelector('#tournament-form');
            if (!form.reportValidity()) return;
            try {
              await api.games.createTournament(Object.fromEntries(new FormData(form)));
              close();
              toast('Tournament created.', 'success');
            } catch (err) { toast(err.message, 'error'); }
          });
        }
      });
    }
  });

  await load();
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------
async function reportsSection(panel) {
  let status = 'open';

  async function load() {
    const data = await api.reports.list(`?status=${status}`);
    panel.innerHTML = `
      <div class="row" style="margin-bottom:1rem">
        <div class="btn-group">
          <button data-status="open" class="${status === 'open' ? 'active' : ''}">Open (${data.counts.open})</button>
          <button data-status="reviewing" class="${status === 'reviewing' ? 'active' : ''}">Reviewing (${data.counts.reviewing})</button>
          <button data-status="resolved" class="${status === 'resolved' ? 'active' : ''}">Resolved</button>
          <button data-status="all" class="${status === 'all' ? 'active' : ''}">Everything</button>
        </div>
        <div class="spacer"></div>
        ${can('logs.view') ? `<button class="btn btn-sm" id="access-log">${icon('shield', 14)} Message access log</button>` : ''}
      </div>

      ${data.reports.length
    ? `<div class="col" style="gap:.85rem">${data.reports.map(reportCard).join('')}</div>`
    : `<div class="card">${emptyState({ iconName: 'shield', title: 'Nothing in the queue', text: 'Reports from students appear here.' })}</div>`}`;
  }

  panel.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-status]');
    if (tab) { status = tab.dataset.status; await load(); return; }

    if (event.target.closest('#access-log')) {
      const { entries } = await api.reports.accessLog();
      modal({
        title: 'Private message access log',
        size: 'modal-lg',
        body: `
          <p class="small muted">Every time a moderator opens a reported private conversation it is recorded here,
          and both members are told.</p>
          ${entries.length
    ? `<div class="list">${entries.map((e) => `
            <div class="list-item">
              ${avatar(e.moderator, 'xs')}
              <div class="meta">
                <div class="title">${esc(e.moderator?.displayName || '')}</div>
                <div class="sub" style="white-space:normal">${esc(e.reason)}</div>
                <div class="tiny faint">Conversation ${e.conversationId} - ${formatDateTime(e.createdAt)}</div>
              </div>
            </div>`).join('')}</div>`
    : '<p class="small faint">No moderator has opened a private conversation.</p>'}`,
        footer: '<button class="btn" data-close>Close</button>'
      });
      return;
    }

    const view = event.target.closest('[data-view-conversation]');
    if (view) {
      const reason = await promptDialog({
        title: 'Open this private conversation',
        label: 'Why do you need to read it? This is recorded and both members are told.',
        placeholder: `Report ${view.dataset.reportId} - reported for bullying`,
        confirmText: 'Open and record'
      });
      if (!reason) return;
      navigate(`/messages/${view.dataset.viewConversation}`);
      return;
    }

    const resolve = event.target.closest('[data-resolve]');
    if (resolve) {
      const id = Number(resolve.dataset.resolve);
      openResolveDialog(id, load);
    }
  });

  await load();
}

function reportCard(report) {
  const preview = report.preview;
  return `
    <article class="card report-card status-${report.status}">
      <div class="row" style="align-items:flex-start">
        <span class="card-title-icon" style="background:var(--danger-soft);color:var(--danger)">${icon('flag', 17)}</span>
        <div style="flex:1;min-width:0">
          <div class="row row-tight">
            <span class="bold">${esc(report.reason)}</span>
            <span class="badge">${esc(report.targetType)}</span>
            <span class="badge ${report.status === 'open' ? 'badge-danger' : (report.status === 'resolved' ? 'badge-success' : 'badge-warning')}">${esc(report.status)}</span>
          </div>
          <div class="tiny faint">Reported by ${esc(report.reporter?.displayName || 'a member')} - ${timeAgo(report.createdAt)}</div>
        </div>
        ${report.status === 'open' || report.status === 'reviewing'
    ? `<button class="btn btn-sm btn-primary" data-resolve="${report.id}">Handle</button>` : ''}
      </div>

      ${report.details ? `<p class="small" style="margin:.7rem 0 0"><strong>Details:</strong> ${esc(report.details)}</p>` : ''}

      ${preview ? `
        <div class="report-preview">
          ${preview.author ? `<div class="row row-tight tiny faint">${avatar(preview.author, 'xs')} ${esc(preview.author.displayName)}${preview.removed ? ' - already removed' : ''}</div>` : ''}
          <p class="small pre-wrap" style="margin:.4rem 0 0">${esc(preview.text || '')}</p>
          <div class="row row-tight" style="margin-top:.5rem">
            ${preview.link ? `<a class="btn btn-sm btn-ghost" href="${esc(preview.link)}">Open</a>` : ''}
            ${preview.requiresAuthorisation && can('messages.moderate')
    ? `<button class="btn btn-sm" data-view-conversation="${preview.conversationId}" data-report-id="${report.id}">
                 ${icon('lock', 13)} Open the conversation
               </button>` : ''}
          </div>
        </div>` : ''}

      ${report.resolution ? `<p class="small muted" style="margin:.7rem 0 0">
        <strong>Outcome:</strong> ${esc(report.resolution)} - ${esc(report.resolvedBy?.displayName || '')}</p>` : ''}
    </article>`;
}

function openResolveDialog(id, onDone) {
  modal({
    title: 'Handle this report',
    body: `
      <div class="field">
        <label>What did you do?</label>
        <textarea class="textarea" id="resolution" placeholder="Spoke to the student. Post removed."></textarea>
      </div>
      <div class="field">
        <label>Action on the reported content</label>
        <select class="select" id="follow-up">
          <option value="none">Leave the content as it is</option>
          <option value="remove_content">Remove the content</option>
        </select>
      </div>`,
    footer: `
      <button class="btn" data-close>Cancel</button>
      <button class="btn" id="dismiss">Dismiss</button>
      <button class="btn btn-primary" id="resolve">Mark resolved</button>`,
    onOpen: ({ root, close }) => {
      const send = async (action) => {
        try {
          await api.reports.resolve(id, {
            action,
            resolution: root.querySelector('#resolution').value,
            followUp: root.querySelector('#follow-up').value
          });
          close();
          toast(action === 'dismiss' ? 'Report dismissed.' : 'Report resolved.', 'success');
          onDone();
        } catch (err) { toast(err.message, 'error'); }
      };
      root.querySelector('#dismiss').addEventListener('click', () => send('dismiss'));
      root.querySelector('#resolve').addEventListener('click', () => send('resolve'));
    }
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------
async function invitationsSection(panel) {
  async function load() {
    const { invitations } = await api.admin.invitations();
    panel.innerHTML = `
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header"><span class="card-title-icon">${icon('ticket', 17)}</span><h3>Invite a student</h3></div>
        <p class="small muted">Create a code and give it to the student. They use it on the join screen.
        Each code works once and can be cancelled at any time.</p>
        <form class="row" id="invite-form" style="align-items:flex-end">
          <div class="field" style="flex:1 1 180px;margin:0"><label>Name (optional)</label><input class="input" name="name" maxlength="60" placeholder="Alex Mensah"></div>
          <div class="field" style="flex:1 1 180px;margin:0"><label>Email (optional)</label><input class="input" name="email" type="email" maxlength="120"></div>
          ${can('users.roles') ? `
          <div class="field" style="flex:0 1 150px;margin:0"><label>Role</label>
            <select class="select" name="role">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>` : ''}
          <button class="btn btn-primary" type="submit">${icon('plus', 15)} Create code</button>
        </form>
      </div>

      <div class="card card-flush">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>For</th><th>Role</th><th>Status</th><th>Created</th><th style="width:52px"></th></tr></thead>
            <tbody>
              ${invitations.map((i) => `
                <tr>
                  <td><code class="invite-code">${esc(i.code)}</code></td>
                  <td class="truncate">${esc(i.name || i.email || '-')}</td>
                  <td><span class="badge">${esc(i.role)}</span></td>
                  <td>
                    ${i.usedBy
    ? `<span class="badge badge-success">Used by ${esc(i.usedBy.displayName)}</span>`
    : (i.revoked ? '<span class="badge badge-danger">Cancelled</span>' : '<span class="badge badge-warning">Waiting</span>')}
                  </td>
                  <td class="tiny faint nowrap">${timeAgo(i.createdAt)}</td>
                  <td>
                    <div class="row row-tight">
                      <button class="icon-button" data-copy="${esc(i.code)}" title="Copy">${icon('link', 15)}</button>
                      ${!i.usedBy && !i.revoked ? `<button class="icon-button" data-revoke="${i.id}" title="Cancel">${icon('close', 15)}</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${invitations.length ? '' : `<div class="card">${emptyState({ iconName: 'ticket', title: 'No invitations yet' })}</div>`}`;
  }

  panel.addEventListener('submit', async (event) => {
    if (!event.target.closest('#invite-form')) return;
    event.preventDefault();
    try {
      const result = await api.admin.createInvitation(Object.fromEntries(new FormData(event.target)));
      modal({
        title: 'Invitation code created',
        body: `
          <p class="small muted">Give this code to the student. It works once.</p>
          <div class="invite-display">${esc(result.code)}</div>
          <p class="tiny faint center">They enter it on the join screen at the sign-in page.</p>`,
        footer: '<button class="btn btn-primary" data-close>Done</button>'
      });
      await load();
    } catch (err) { toast(err.message, 'error'); }
  });

  panel.addEventListener('click', async (event) => {
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); toast('Code copied.', 'success'); }
      catch { toast(copy.dataset.copy, 'info', 'Invitation code'); }
      return;
    }

    const revoke = event.target.closest('[data-revoke]');
    if (revoke) {
      const yes = await confirmDialog({ title: 'Cancel this code?', message: 'It will no longer work.', confirmText: 'Cancel code', danger: true });
      if (!yes) return;
      try { await api.admin.revokeInvitation(Number(revoke.dataset.revoke)); await load(); } catch (err) { toast(err.message, 'error'); }
    }
  });

  await load();
}

// ---------------------------------------------------------------------------
// Roles and permissions
// ---------------------------------------------------------------------------
async function rolesSection(panel) {
  const { roles, permissions } = await api.admin.roles();
  panel.innerHTML = `
    <div class="alert" style="margin-bottom:1rem">${icon('info', 17)}
      <div>Roles decide what each member may do. The browser hides buttons a member cannot use,
      but the server checks the permission again on every single request.</div>
    </div>
    <div class="card card-flush">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th style="min-width:220px">Permission</th>${roles.map((r) => `<th class="center nowrap">${esc(r.name)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${permissions.map((p) => `
              <tr>
                <td>
                  <div class="bold tiny" style="font-family:var(--font-mono)">${esc(p.key)}</div>
                  <div class="tiny faint" style="white-space:normal">${esc(p.description)}</div>
                </td>
                ${roles.map((r) => `
                  <td class="center">${r.permissions.includes(p.key)
    ? `<span style="color:var(--success)">${icon('check', 15)}</span>`
    : '<span class="faint">-</span>'}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Community settings
// ---------------------------------------------------------------------------
async function settingsSection(panel) {
  const { settings } = await api.admin.settings();

  panel.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('lock', 17)}</span><h3>Who can join</h3></div>
      <div class="field">
        <label>Registration</label>
        <select class="select" data-setting="registration_mode">
          <option value="invite" ${settings.registration_mode === 'invite' ? 'selected' : ''}>Invitation code required (recommended)</option>
          <option value="open" ${settings.registration_mode === 'open' ? 'selected' : ''}>Anybody with the link can join</option>
          <option value="closed" ${settings.registration_mode === 'closed' ? 'selected' : ''}>Closed - nobody new can join</option>
        </select>
        <span class="hint">This is a private class network, so invitation codes are the safest choice.</span>
      </div>
      <div class="field">
        <label>Who can create clubs</label>
        <select class="select" data-setting="club_creation">
          <option value="anyone" ${settings.club_creation === 'anyone' ? 'selected' : ''}>Any student, straight away</option>
          <option value="approval" ${settings.club_creation === 'approval' ? 'selected' : ''}>Students may ask, an admin approves</option>
          <option value="admins" ${settings.club_creation === 'admins' ? 'selected' : ''}>Administrators only</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('settings', 17)}</span><h3>Community</h3></div>
      <div class="field"><label>Community name</label><input class="input" data-setting="community_name" value="${esc(settings.community_name || '')}"></div>
      <div class="field"><label>Class name</label><input class="input" data-setting="class_name" value="${esc(settings.class_name || '')}"></div>
      <div class="field"><label>Welcome message on the sign-in screen</label>
        <textarea class="textarea" data-setting="welcome_message">${esc(settings.welcome_message || '')}</textarea></div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title-icon">${icon('zap', 17)}</span><h3>XP rewards</h3></div>
      <p class="small muted">Game XP is only for the Gaming Hub. It never affects school grades.</p>
      <div class="grid grid-3">
        <div class="field"><label>Win a game</label><input class="input" type="number" data-setting="xp_win" value="${esc(settings.xp_win)}"></div>
        <div class="field"><label>Finish a challenge</label><input class="input" type="number" data-setting="xp_challenge" value="${esc(settings.xp_challenge)}"></div>
        <div class="field"><label>Win a tournament</label><input class="input" type="number" data-setting="xp_tournament" value="${esc(settings.xp_tournament)}"></div>
        <div class="field"><label>Write a post</label><input class="input" type="number" data-setting="xp_post" value="${esc(settings.xp_post)}"></div>
        <div class="field"><label>Complete homework</label><input class="input" type="number" data-setting="xp_homework_complete" value="${esc(settings.xp_homework_complete)}"></div>
      </div>
    </div>

    <button class="btn btn-primary btn-lg" id="save-settings">${icon('check', 16)} Save all settings</button>`;

  panel.querySelector('#save-settings').addEventListener('click', async (event) => {
    const payload = {};
    for (const field of panel.querySelectorAll('[data-setting]')) {
      payload[field.dataset.setting] = field.type === 'checkbox' ? String(field.checked) : field.value;
    }
    event.currentTarget.disabled = true;
    try {
      await api.admin.updateSettings(payload);
      toast('Settings saved.', 'success');
      store.config.communityName = payload.community_name || store.config.communityName;
      store.config.className = payload.class_name || store.config.className;
    } catch (err) { toast(err.message, 'error'); }
    event.currentTarget.disabled = false;
  });
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------
async function logsSection(panel) {
  let search = '';
  let offset = 0;

  panel.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div class="topbar-search" style="max-width:none">
        ${icon('search', 16)}
        <input class="input" id="log-search" placeholder="Search the log..." style="padding-left:2.2rem">
      </div>
    </div>
    <div id="log-list"><div class="spinner spinner-center"></div></div>`;

  async function load() {
    const holder = panel.querySelector('#log-list');
    const data = await api.admin.logs(`?limit=60&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    holder.innerHTML = data.logs.length
      ? `<div class="card card-flush"><div class="list">${data.logs.map(logRow).join('')}</div></div>
         <p class="tiny faint center" style="margin-top:.8rem">${plural(data.total, 'entry', 'entries')} in total.</p>`
      : `<div class="card">${emptyState({ iconName: 'clock', title: 'Nothing in the log yet' })}</div>`;
  }

  panel.querySelector('#log-search').addEventListener('input', debounce((event) => {
    search = event.target.value.trim();
    offset = 0;
    load();
  }, 250));

  await load();
}
