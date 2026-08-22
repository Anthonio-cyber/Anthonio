// ==========================================================
// Coding Hub - browser entry point.
// Signs the member in, builds the shell and starts the router.
// ==========================================================
import { api } from './lib/api.js';
import { store, setUser, applyTheme, connectRealtime, refreshCounts } from './lib/store.js';
import { route, setNotFound, startRouter, navigate, currentPath } from './lib/router.js';
import { renderShell, setPageTitle } from './components/shell.js';
import { renderAuth } from './views/auth.js';
import { emptyState } from './components/common.js';
import { toast } from './lib/ui.js';
import { registerServiceWorker, startConnectionWatch, watchInstallPrompt } from './lib/offline.js';

applyTheme();

registerServiceWorker();
watchInstallPrompt();
startConnectionWatch();

async function boot() {
  try {
    store.config = await api.auth.config();
  } catch {
    document.getElementById('app').innerHTML = `
      <div class="boot-screen" style="display:grid;place-items:center;min-height:100vh;text-align:center;padding:2rem">
        <div>
          <div class="boot-logo">&lt;/&gt;</div>
          <h1>${navigator.onLine ? 'The Coding Hub is not responding' : 'You are offline'}</h1>
          <p class="muted">${navigator.onLine
    ? 'Make sure the server is running, then reload this page.'
    : 'Reconnect and try again.'}</p>
          <p class="small faint">On the computer running it, start it with <code>npm start</code>.</p>
          <button class="btn btn-primary" onclick="location.reload()">Try again</button>
        </div>
      </div>`;
    return;
  }

  let me = null;
  try {
    me = (await api.auth.me()).user;
  } catch { me = null; }

  if (!me) {
    const wantsJoin = currentPath().startsWith('/join') || currentPath().startsWith('/register');
    renderAuth(wantsJoin ? 'register' : 'login', startApp);
    return;
  }

  setUser(me);
  await startApp();
}

async function startApp() {
  if (!store.user) setUser((await api.auth.me()).user);

  const mount = renderShell();
  registerRoutes();
  connectRealtime().catch(() =>
    toast('Live updates are unavailable. The hub still works, but you may need to refresh.', 'warning'));

  if (['/login', '/join', '/register', ''].includes(currentPath().split('?')[0])) {
    navigate('/', { replace: true });
  }

  startRouter(mount);
  setInterval(refreshCounts, 60_000);

  if (store.user.mustChangePassword) {
    const { openChangePassword } = await import('./views/settings.js');
    openChangePassword(true);
  }
}

function registerRoutes() {
  const lazy = (path, loader) => route(path, async (context) => {
    const module = await loader();
    return module.default(context);
  });

  // ---- Learning ----
  lazy('/',                 () => import('./views/home.js'));
  lazy('/subjects',         () => import('./views/subjects.js'));
  lazy('/subject/:key',     () => import('./views/subjects.js'));
  lazy('/topic/:id',        () => import('./views/topic.js'));
  lazy('/lesson/:id',       () => import('./views/lesson.js'));
  lazy('/practice',         () => import('./views/practice.js'));
  lazy('/challenges',       () => import('./views/challenges.js'));

  // ---- The member's own record ----
  lazy('/progress',         () => import('./views/progress.js'));
  lazy('/history',          () => import('./views/history.js'));
  lazy('/bookmarks',        () => import('./views/bookmarks.js'));
  lazy('/achievements',     () => import('./views/achievements.js'));
  lazy('/leaderboard',      () => import('./views/leaderboard.js'));

  // ---- Community ----
  lazy('/members',          () => import('./views/members.js'));
  lazy('/profile',          () => import('./views/profile.js'));
  lazy('/profile/:username', () => import('./views/profile.js'));
  lazy('/messages',         () => import('./views/messages.js'));
  lazy('/messages/:id',     () => import('./views/messages.js'));
  lazy('/announcements',    () => import('./views/announcements.js'));
  lazy('/announcements/:id', () => import('./views/announcements.js'));
  lazy('/notifications',    () => import('./views/notifications.js'));
  lazy('/settings',         () => import('./views/settings.js'));
  lazy('/search',           () => import('./views/search.js'));

  // ---- Administration ----
  lazy('/admin',            () => import('./views/admin.js'));
  lazy('/admin/:section',   () => import('./views/admin.js'));

  setNotFound(({ mount }) => {
    setPageTitle('Not found');
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'search',
      title: 'That page does not exist',
      text: 'The link may be old, or the page may have been removed.',
      action: '<a class="btn btn-primary" href="#/">Back to the dashboard</a>'
    })}</div>`;
  });
}

boot();
