// ==========================================================
// Personal settings: appearance, privacy, password, blocked list.
// ==========================================================
import { esc, timeAgo } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, applyTheme, can } from '../lib/store.js';
import { setPageTitle, signOut } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';
import { toast, modal, confirmDialog } from '../lib/ui.js';
import { openEditProfile } from './profile.js';
import { canInstall, isInstalled, promptInstall, pendingCount, flushQueue, isLive, clearOfflineData } from '../lib/offline.js';

const ACCENTS = [
  ['violet', 'Violet'], ['cyan', 'Cyan'], ['emerald', 'Emerald'], ['amber', 'Amber'], ['rose', 'Rose']
];

export default async function settings({ mount }) {
  setPageTitle('Settings');
  const u = store.user;

  mount.innerHTML = `
    <div class="page page-narrow">
      <h1>Settings</h1>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('user', 17)}</span><h3>Your account</h3></div>
        <div class="row">
          ${avatar(u, 'lg')}
          <div style="flex:1;min-width:0">
            <div class="bold">${esc(u.displayName)}</div>
            <div class="tiny faint">@${esc(u.username)}${u.email ? ` - ${esc(u.email)}` : ''}</div>
            <div class="tiny faint">${esc(u.roleName)} - level ${u.level} - ${u.xp} XP</div>
          </div>
          <button class="btn btn-sm" id="edit-profile-settings">${icon('edit', 14)} Edit</button>
        </div>
      </div>

      <div class="card install-card" id="app-card">
        <div class="card-header">
          <span class="install-icon">${icon('grid', 20)}</span>
          <div style="flex:1;min-width:0">
            <h3 style="margin:0">Grade 8 Hub app</h3>
            <p class="tiny faint" style="margin:0">Install it and it opens in its own window, with its own icon.</p>
          </div>
        </div>
        <div id="install-area"></div>
        <div class="divider"></div>
        <div class="section-title">${icon('refresh', 14)} Offline</div>
        <p class="small muted" style="margin-bottom:.6rem">
          The app keeps a copy of your dashboard, homework, announcements, feed and clubs on
          this device, and every game works with no connection at all. Sending messages and
          posts still needs the class server.
        </p>
        <div id="offline-area"></div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('moon', 17)}</span><h3>Appearance</h3></div>
        <div class="field">
          <label>Theme</label>
          <div class="btn-group">
            <button data-theme="dark" class="${u.theme === 'dark' ? 'active' : ''}">${icon('moon', 14)} Dark</button>
            <button data-theme="light" class="${u.theme === 'light' ? 'active' : ''}">${icon('sun', 14)} Light</button>
          </div>
        </div>
        <div class="field">
          <label>Accent colour</label>
          <div class="row row-tight">
            ${ACCENTS.map(([key, label]) => `
              <button class="accent-swatch ${u.accent === key ? 'active' : ''}" data-accent="${key}"
                      title="${label}" aria-label="${label}"><span class="swatch-${key}"></span></button>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('eye', 17)}</span><h3>Privacy</h3></div>
        <label class="switch">
          <span class="switch-label">Show when I am online
            <small>Classmates see a green dot next to your name.</small></span>
          <input type="checkbox" id="show-online" ${u.showOnline ? 'checked' : ''}>
        </label>
        <div class="divider"></div>
        <div class="section-title">${icon('block', 14)} Blocked members</div>
        <div id="blocked-list"><div class="spinner spinner-center" style="margin:1rem auto"></div></div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('lock', 17)}</span><h3>Security</h3></div>
        <p class="small muted">Change your password regularly, and never share it with anybody.</p>
        <button class="btn" id="change-password">${icon('lock', 15)} Change my password</button>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('info', 17)}</span><h3>About the hub</h3></div>
        <div class="grid grid-2 small">
          <div><div class="tiny faint">Community</div><div class="bold">${esc(store.config.communityName)}</div></div>
          <div><div class="tiny faint">Class</div><div class="bold">${esc(store.config.className)}</div></div>
          <div><div class="tiny faint">Your role</div><div class="bold">${esc(u.roleName)}</div></div>
          <div><div class="tiny faint">Member since</div><div class="bold">${timeAgo(u.joinedAt)}</div></div>
        </div>
        ${!u.canPost || !u.canMessage ? `
          <div class="alert alert-warning" style="margin-top:1rem">${icon('warning', 17)}
            <div>An administrator has limited your account:
              ${!u.canPost ? '<br>You cannot post at the moment.' : ''}
              ${!u.canMessage ? '<br>You cannot send messages at the moment.' : ''}
            </div>
          </div>` : ''}
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon" style="background:var(--danger-soft);color:var(--danger)">${icon('logout', 17)}</span><h3>Sign out</h3></div>
        <p class="small muted">You will need your username and password to sign back in.</p>
        <button class="btn btn-danger" id="sign-out">${icon('logout', 15)} Sign out</button>
      </div>
    </div>`;

  loadBlocked(mount);
  renderAppCard(mount);

  mount.addEventListener('click', async (event) => {
    const themeButton = event.target.closest('[data-theme]');
    if (themeButton) {
      const theme = themeButton.dataset.theme;
      store.user.theme = theme;
      applyTheme();
      for (const b of mount.querySelectorAll('[data-theme]')) b.classList.toggle('active', b === themeButton);
      try { await api.users.updateMe({ theme }); } catch { /* stored locally */ }
      return;
    }

    const accentButton = event.target.closest('[data-accent]');
    if (accentButton) {
      const accent = accentButton.dataset.accent;
      store.user.accent = accent;
      applyTheme();
      for (const b of mount.querySelectorAll('[data-accent]')) b.classList.toggle('active', b === accentButton);
      try { await api.users.updateMe({ accent }); } catch { /* stored locally */ }
      return;
    }

    if (event.target.closest('#install-app')) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') toast('Installed. Look for the Grade 8 Hub icon on your device.', 'success');
      else if (outcome === 'unavailable') {
        toast('Use your browser menu and choose "Install app" or "Add to Home Screen".', 'info');
      }
      renderAppCard(mount);
      return;
    }

    if (event.target.closest('#send-pending')) {
      const sent = await flushQueue();
      toast(sent ? `${sent} score${sent === 1 ? '' : 's'} sent.` : 'Nothing was waiting to send.', sent ? 'success' : 'info');
      renderAppCard(mount);
      return;
    }

    if (event.target.closest('#edit-profile-settings')) return openEditProfile();
    if (event.target.closest('#change-password')) return openChangePassword();
    if (event.target.closest('#sign-out')) {
      const yes = await confirmDialog({
        title: 'Sign out?',
        message: 'The copy of the class data saved on this device will be removed.',
        confirmText: 'Sign out'
      });
      if (yes) { clearOfflineData(); await signOut(); }
      return;
    }

    const unblock = event.target.closest('[data-unblock]');
    if (unblock) {
      try {
        await api.users.unblock(Number(unblock.dataset.unblock));
        toast('Unblocked.', 'success');
        loadBlocked(mount);
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  mount.querySelector('#show-online').addEventListener('change', async (event) => {
    const showOnline = event.target.checked;
    store.user.showOnline = showOnline;
    try {
      await api.users.updateMe({ showOnline });
      toast(showOnline ? 'Classmates can see when you are online.' : 'You now appear offline to classmates.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function loadBlocked(mount) {
  const holder = mount.querySelector('#blocked-list');
  if (!holder) return;
  try {
    const { users } = await api.users.blocked();
    holder.innerHTML = users.length
      ? `<div class="list">${users.map((u) => `
        <div class="list-item">
          ${avatar(u, 'sm')}
          <div class="meta"><div class="title">${esc(u.displayName)}</div><div class="sub">@${esc(u.username)}</div></div>
          <button class="btn btn-sm" data-unblock="${u.id}">Unblock</button>
        </div>`).join('')}</div>`
      : '<p class="small faint">You have not blocked anybody.</p>';
  } catch {
    holder.innerHTML = '<p class="small faint">Could not load the blocked list.</p>';
  }
}

export function openChangePassword(forced = false) {
  modal({
    title: forced ? 'Please choose a new password' : 'Change your password',
    closeOnBackdrop: !forced,
    body: `
      ${forced ? `<div class="alert alert-warning" style="margin-bottom:1rem">${icon('warning', 17)}
        <div>Your account was set up with a temporary password. Choose your own before you carry on.</div></div>` : ''}
      <form id="password-form">
        <div class="field">
          <label>Current password</label>
          <input class="input" type="password" name="currentPassword" autocomplete="current-password" required>
        </div>
        <div class="field">
          <label>New password</label>
          <input class="input" type="password" name="newPassword" autocomplete="new-password" required minlength="8">
          <span class="hint">At least 8 characters. Do not reuse a password from another site.</span>
        </div>
        <div class="field">
          <label>Repeat the new password</label>
          <input class="input" type="password" name="confirmPassword" autocomplete="new-password" required minlength="8">
        </div>
        <div class="auth-error" id="password-error" hidden></div>
      </form>`,
    footer: `${forced ? '' : '<button class="btn" data-close>Cancel</button>'}
             <button class="btn btn-primary" id="save-password">Save new password</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('#save-password').addEventListener('click', async (event) => {
        const form = root.querySelector('#password-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form));
        const errorBox = root.querySelector('#password-error');
        errorBox.hidden = true;

        if (data.newPassword !== data.confirmPassword) {
          errorBox.hidden = false;
          errorBox.textContent = 'The two new passwords do not match.';
          return;
        }

        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api.auth.changePassword(data.currentPassword, data.newPassword);
          store.user.mustChangePassword = false;
          close();
          toast('Your password has been changed.', 'success');
        } catch (err) {
          errorBox.hidden = false;
          errorBox.textContent = err.message;
          button.disabled = false;
        }
      });
    }
  });
}


/** Draws the install button and the offline status inside Settings. */
function renderAppCard(mount) {
  const install = mount.querySelector('#install-area');
  const offlineArea = mount.querySelector('#offline-area');
  if (!install || !offlineArea) return;

  if (isInstalled()) {
    install.innerHTML = `<div class="alert alert-success">${icon('check', 17)}
      <div>The Grade 8 Hub is installed on this device and running as an app.</div></div>`;
  } else if (canInstall()) {
    install.innerHTML = `<button class="btn btn-primary" id="install-app">${icon('upload', 15)} Install the app</button>`;
  } else {
    install.innerHTML = `<p class="small muted" style="margin:0">
      To install it: in Chrome or Edge open the menu and choose <strong>Install app</strong>.
      On an iPhone or iPad, tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.
    </p>`;
  }

  const waiting = pendingCount();
  offlineArea.innerHTML = `
    <div class="row row-tight">
      <span class="badge ${isLive() ? 'badge-success' : 'badge-warning'}">
        ${icon(isLive() ? 'check' : 'warning', 12)} ${isLive() ? 'Connected to the class server' : 'Offline'}
      </span>
      ${waiting
    ? `<span class="badge badge-info">${waiting} score${waiting === 1 ? '' : 's'} waiting to send</span>
         <button class="btn btn-sm" id="send-pending">Send now</button>`
    : '<span class="badge">Nothing waiting to send</span>'}
    </div>`;
}
