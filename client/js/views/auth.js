// ==========================================================
// The sign-in and join screens (shown before anyone is signed in).
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, setUser, applyTheme } from '../lib/store.js';
import { toast } from '../lib/ui.js';

export function renderAuth(mode = 'login', onSignedIn) {
  applyTheme();
  const app = document.getElementById('app');
  app.className = 'auth-page';
  app.innerHTML = `
    <div class="auth-layout">
      <section class="auth-side">
        <div class="auth-side-inner">
          <div class="brand" style="padding:0 0 2rem">
            <span class="brand-mark" style="width:48px;height:48px;border-radius:14px;font-size:1.1rem">G8</span>
            <span class="brand-text" style="font-size:1.2rem">
              ${esc(store.config.communityName || 'Grade 8 Hub')}
              <small>${esc(store.config.className || 'Grade 8')} community</small>
            </span>
          </div>
          <h1 class="auth-headline">Our class,<br>in one place.</h1>
          <p class="auth-sub">${esc(store.config.welcomeMessage || 'A private network for our Grade 8 class - messages, clubs, homework, announcements and the Gaming Hub.')}</p>
          <ul class="auth-points">
            <li>${icon('message', 18)}<span>Message classmates and club groups</span></li>
            <li>${icon('book', 18)}<span>Keep track of every homework due date</span></li>
            <li>${icon('game', 18)}<span>Play games and climb the leaderboard</span></li>
            <li>${icon('users', 18)}<span>Start and run your own clubs</span></li>
            <li>${icon('lock', 18)}<span>Private - only invited class members can join</span></li>
          </ul>
        </div>
      </section>

      <section class="auth-form-side">
        <div class="auth-card" id="auth-card"></div>
      </section>
    </div>`;

  showForm(mode, onSignedIn);
}

function showForm(mode, onSignedIn) {
  const card = document.getElementById('auth-card');
  const registrationMode = store.config.registrationMode || 'invite';

  if (mode === 'register') {
    card.innerHTML = `
      <h2>Join the hub</h2>
      <p class="muted small">
        ${registrationMode === 'invite'
    ? 'Enter the invitation code your teacher or an administrator gave you.'
    : 'Fill in your details to create your account.'}
      </p>
      <form id="auth-form" novalidate>
        ${registrationMode === 'invite' ? `
        <div class="field">
          <label for="code">Invitation code</label>
          <input class="input" id="code" name="code" placeholder="GRADE8-AB92K" autocomplete="off" required
                 style="text-transform:uppercase;letter-spacing:.08em;font-family:var(--font-mono)">
          <span class="hint" id="code-hint">It looks like GRADE8-AB92K.</span>
        </div>` : ''}
        <div class="field">
          <label for="displayName">Your full name</label>
          <input class="input" id="displayName" name="displayName" placeholder="Alex Mensah" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="username">Choose a username</label>
          <input class="input" id="username" name="username" placeholder="alex" autocomplete="username" required>
          <span class="hint">3-20 letters, numbers, dots or underscores.</span>
        </div>
        <div class="field">
          <label for="email">Email (optional)</label>
          <input class="input" id="email" name="email" type="email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="password-wrap">
            <input class="input" id="password" name="password" type="password" autocomplete="new-password" required>
            <button type="button" class="password-toggle" data-toggle-password aria-label="Show password">${icon('eye', 17)}</button>
          </div>
          <span class="hint">At least 8 characters.</span>
        </div>
        <div class="auth-error" id="auth-error" hidden></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">Create my account</button>
      </form>
      <p class="center small muted" style="margin-top:1.2rem">
        Already have an account? <a href="#" data-mode="login">Sign in</a>
      </p>`;
  } else {
    card.innerHTML = `
      <h2>Welcome back</h2>
      <p class="muted small">Sign in to the ${esc(store.config.className || 'Grade 8')} community.</p>
      <form id="auth-form" novalidate>
        <div class="field">
          <label for="username">Username or email</label>
          <input class="input" id="username" name="username" autocomplete="username" required autofocus>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="password-wrap">
            <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
            <button type="button" class="password-toggle" data-toggle-password aria-label="Show password">${icon('eye', 17)}</button>
          </div>
        </div>
        <div class="auth-error" id="auth-error" hidden></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>
      </form>
      ${registrationMode === 'closed' ? '' : `
      <p class="center small muted" style="margin-top:1.2rem">
        New here? <a href="#" data-mode="register">Join with an invitation code</a>
      </p>`}`;
  }

  card.querySelector('[data-mode]')?.addEventListener('click', (event) => {
    event.preventDefault();
    showForm(event.target.dataset.mode, onSignedIn);
  });

  card.querySelector('[data-toggle-password]')?.addEventListener('click', (event) => {
    const input = card.querySelector('#password');
    const shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    event.currentTarget.innerHTML = icon(shown ? 'eye' : 'eyeOff', 17);
  });

  const codeInput = card.querySelector('#code');
  if (codeInput) {
    codeInput.addEventListener('blur', async () => {
      const code = codeInput.value.trim().toUpperCase();
      if (!code) return;
      const hint = card.querySelector('#code-hint');
      try {
        const result = await api.auth.checkInvite(code);
        if (result.valid) {
          hint.textContent = 'Code accepted.';
          hint.style.color = 'var(--success)';
          if (result.name && !card.querySelector('#displayName').value) card.querySelector('#displayName').value = result.name;
          if (result.email && !card.querySelector('#email').value) card.querySelector('#email').value = result.email;
        } else {
          hint.textContent = result.reason;
          hint.style.color = 'var(--danger)';
        }
      } catch { /* the form checks it again on submit */ }
    });
  }

  card.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = card.querySelector('#auth-error');
    errorBox.hidden = true;

    const data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    const originalText = button.textContent;
    button.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span>';

    try {
      const result = mode === 'register'
        ? await api.auth.register({ ...data, code: (data.code || '').toUpperCase() })
        : await api.auth.login(data.username, data.password);
      setUser(result.user);
      toast(mode === 'register' ? 'Welcome to the Grade 8 Hub.' : `Welcome back, ${result.user.displayName}.`, 'success');
      await onSignedIn();
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = err.message;
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}
