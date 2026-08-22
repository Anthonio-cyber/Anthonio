// ==========================================================
// Coding Hub - your own settings: profile, appearance,
// messaging privacy (section 28), password and blocked people.
// ==========================================================
import { esc, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, setUser, applyTheme } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';
import { toast, modal, withBusy, confirmDialog } from '../lib/ui.js';
import { signOut } from '../components/shell.js';

const ACCENTS = ['violet', 'cyan', 'emerald', 'amber', 'rose'];

export default async function settings({ mount }) {
  setPageTitle('Settings');
  const me = store.user;

  mount.innerHTML = `
    <div class="page page-narrow">
      <header class="page-head">
        <div>
          <h1>Settings</h1>
          <p class="muted">Your profile, how the hub looks, and who may message you.</p>
        </div>
      </header>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('user', 17)}</span><h3>Profile</h3></div>
        <div class="row" style="gap:1rem;align-items:center;margin-bottom:1rem">
          ${avatar(me, 'lg')}
          <div>
            <label class="btn btn-sm" style="cursor:pointer">
              ${icon('upload', 14)} Change picture
              <input type="file" accept="image/*" id="avatar-input" hidden>
            </label>
          </div>
        </div>
        <div class="field"><label>Display name</label>
          <input class="input" data-field="displayName" value="${esc(me.displayName)}"></div>
        <div class="field"><label>Username</label>
          <input class="input" data-field="username" value="${esc(me.username)}">
          <span class="hint">Other people find and mention you by this.</span></div>
        <div class="field"><label>Bio</label>
          <textarea class="textarea" data-field="bio" rows="3" placeholder="A line or two about you.">${esc(me.bio || '')}</textarea></div>
        <div class="grid grid-2">
          <div class="field"><label>Location</label>
            <input class="input" data-field="location" value="${esc(me.location || '')}"></div>
          <div class="field"><label>Website</label>
            <input class="input" data-field="website" value="${esc(me.website || '')}" placeholder="https://"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('sun', 17)}</span><h3>Appearance</h3></div>
        <div class="field"><label>Theme</label>
          <select class="select" data-field="theme">
            <option value="dark" ${me.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${me.theme === 'light' ? 'selected' : ''}>Light</option>
          </select></div>
        <div class="field"><label>Accent colour</label>
          <div class="row" style="gap:.5rem;flex-wrap:wrap">
            ${ACCENTS.map((accent) => `
              <button type="button" class="accent-dot ${me.accent === accent ? 'active' : ''}"
                data-accent="${accent}" data-accent-swatch="${accent}" title="${accent}"></button>`).join('')}
          </div></div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('lock', 17)}</span><h3>Messaging and privacy</h3></div>
        <div class="field"><label>Who can message me</label>
          <select class="select" data-field="whoCanMessage">
            <option value="everyone" ${me.privacy.whoCanMessage === 'everyone' ? 'selected' : ''}>Everyone</option>
            <option value="registered" ${me.privacy.whoCanMessage === 'registered' ? 'selected' : ''}>Anybody with an account</option>
            <option value="connections" ${me.privacy.whoCanMessage === 'connections' ? 'selected' : ''}>Only people I have connected with</option>
            <option value="nobody" ${me.privacy.whoCanMessage === 'nobody' ? 'selected' : ''}>Nobody</option>
          </select>
          <span class="hint">Moderators can always reach you about a report.</span></div>
        <label class="check"><input type="checkbox" data-field="showOnline" ${me.privacy.showOnline ? 'checked' : ''}>
          <span>Show when I am online</span></label>
        <label class="check"><input type="checkbox" data-field="showLastSeen" ${me.privacy.showLastSeen ? 'checked' : ''}>
          <span>Show when I was last seen</span></label>
        <label class="check"><input type="checkbox" data-field="readReceipts" ${me.privacy.readReceipts ? 'checked' : ''}>
          <span>Let people see when I have read their messages</span></label>
      </div>

      <button class="btn btn-primary btn-lg" id="save">${icon('check', 16)} Save my settings</button>

      <div class="card" style="margin-top:1.5rem">
        <div class="card-header"><span class="card-title-icon">${icon('block', 17)}</span><h3>Blocked people</h3></div>
        <div id="blocked"><div class="spinner spinner-center"></div></div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('shield', 17)}</span><h3>Account</h3></div>
        <div class="row" style="gap:.6rem;flex-wrap:wrap">
          <button type="button" class="btn" id="change-password">${icon('lock', 15)} Change password</button>
          <button type="button" class="btn btn-danger" id="sign-out">${icon('logout', 15)} Sign out</button>
        </div>
      </div>
    </div>`;

  // ---- appearance previews immediately ----
  delegate(mount, 'click', '[data-accent]', (_event, node) => {
    for (const dot of mount.querySelectorAll('[data-accent]')) dot.classList.remove('active');
    node.classList.add('active');
    store.user.accent = node.dataset.accent;
    applyTheme();
  });
  mount.querySelector('[data-field="theme"]').addEventListener('change', (event) => {
    store.user.theme = event.target.value;
    applyTheme();
  });

  mount.querySelector('#save').addEventListener('click', async (event) => {
    const value = (name) => mount.querySelector(`[data-field="${name}"]`);
    const payload = {
      displayName: value('displayName').value.trim(),
      username: value('username').value.trim(),
      bio: value('bio').value.trim(),
      location: value('location').value.trim(),
      website: value('website').value.trim(),
      theme: value('theme').value,
      accent: mount.querySelector('[data-accent].active')?.dataset.accent || 'violet',
      whoCanMessage: value('whoCanMessage').value,
      showOnline: value('showOnline').checked,
      showLastSeen: value('showLastSeen').checked,
      readReceipts: value('readReceipts').checked
    };
    await withBusy(event.currentTarget, async () => {
      try {
        const { user } = await api.users.updateMe(payload);
        setUser(user);
        toast('Settings saved.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }, 'Saving...');
  });

  mount.querySelector('#avatar-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      const { avatarUrl } = await api.users.uploadAvatar(form);
      store.user.avatarUrl = avatarUrl;
      setUser(store.user);
      toast('Picture updated.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  mount.querySelector('#change-password').addEventListener('click', () => openChangePassword(false));
  mount.querySelector('#sign-out').addEventListener('click', signOut);

  // ---- blocked list ----
  const blocked = mount.querySelector('#blocked');
  async function loadBlocked() {
    try {
      const result = await api.users.blocked();
      blocked.innerHTML = result.blocked.length
        ? `<div class="list">${result.blocked.map((b) => `
            <div class="list-item">
              ${avatar(b.user, 'sm')}
              <div class="meta">
                <div class="title">${esc(b.user?.displayName || 'Unknown')}</div>
                <div class="sub">Blocked ${esc(String(b.since).slice(0, 10))}</div>
              </div>
              <button type="button" class="btn btn-sm" data-unblock="${b.user?.id}">Unblock</button>
            </div>`).join('')}</div>`
        : '<p class="small faint center">You have not blocked anybody.</p>';
    } catch {
      blocked.innerHTML = '<p class="small faint center">Could not load the list.</p>';
    }
  }
  delegate(mount, 'click', '[data-unblock]', async (_event, node) => {
    try {
      await api.users.unblock(Number(node.dataset.unblock));
      toast('Unblocked.', 'success');
      loadBlocked();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  await loadBlocked();
}

/** Also used on first sign-in, when the password must be changed. */
export function openChangePassword(forced = false) {
  modal({
    title: forced ? 'Choose your own password' : 'Change password',
    closeOnBackdrop: !forced,
    body: `
      ${forced ? '<p class="small muted">This account still uses the password it was created with. Please pick your own.</p>' : ''}
      <div class="field"><label>Current password</label>
        <input class="input" type="password" data-current></div>
      <div class="field"><label>New password</label>
        <input class="input" type="password" data-new placeholder="At least 8 characters"></div>
      <div class="field"><label>New password again</label>
        <input class="input" type="password" data-confirm></div>`,
    footer: `
      ${forced ? '' : '<button type="button" class="btn" data-close>Cancel</button>'}
      <button type="button" class="btn btn-primary" data-save>Change it</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const current = root.querySelector('[data-current]').value;
        const next = root.querySelector('[data-new]').value;
        const confirmValue = root.querySelector('[data-confirm]').value;
        if (next.length < 8) { toast('The new password needs at least 8 characters.', 'warning'); return; }
        if (next !== confirmValue) { toast('The two new passwords do not match.', 'warning'); return; }
        await withBusy(event.currentTarget, async () => {
          try {
            await api.auth.changePassword(current, next);
            close();
            toast('Password changed.', 'success');
            if (store.user) store.user.mustChangePassword = false;
          } catch (err) {
            toast(err.message, 'error');
          }
        }, 'Changing...');
      });
    }
  });
}
