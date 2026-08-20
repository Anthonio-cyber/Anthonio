// ==========================================================
// Grade 8 Hub - browser entry point.
// Signs the member in, builds the shell and starts the router.
// ==========================================================
import { api } from './lib/api.js';
import { store, setUser, applyTheme, connectRealtime, refreshCounts } from './lib/store.js';
import { route, setNotFound, startRouter, navigate, currentPath } from './lib/router.js';
import { renderShell, setPageTitle } from './components/shell.js';
import { renderAuth } from './views/auth.js';
import { emptyState } from './components/common.js';
import { toast } from './lib/ui.js';

applyTheme();

async function boot() {
  try {
    store.config = await api.auth.config();
  } catch {
    document.getElementById('app').innerHTML = `
      <div class="boot-screen" style="display:grid;place-items:center;min-height:100vh;text-align:center;padding:2rem">
        <div>
          <h1>The Grade 8 Hub is not responding</h1>
          <p class="muted">Make sure the server is running, then reload this page.</p>
          <p class="small faint">Start it from the project folder with <code>npm start</code>.</p>
          <button class="btn btn-primary" onclick="location.reload()">Try again</button>
        </div>
      </div>`;
    return;
  }

  let me = null;
  try {
    const result = await api.auth.me();
    me = result.user;
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
  if (!store.user) {
    const result = await api.auth.me();
    setUser(result.user);
  }

  const mount = renderShell();
  registerRoutes();
  connectRealtime().catch(() => toast('Live updates are unavailable. The hub still works, but you may need to refresh.', 'warning'));

  if (['/login', '/join', '/register', ''].includes(currentPath().split('?')[0])) {
    navigate('/', { replace: true });
  }

  startRouter(mount);
  setInterval(refreshCounts, 60_000);

  if (store.user.mustChangePassword) {
    const { modal } = await import('./lib/ui.js');
    const { openChangePassword } = await import('./views/settings.js');
    openChangePassword(true);
  }
}

function registerRoutes() {
  const lazy = (path, loader) => route(path, async (context) => {
    const module = await loader();
    return module.default(context);
  });

  lazy('/',               () => import('./views/home.js'));
  lazy('/feed',           () => import('./views/feed.js'));
  lazy('/post/:id',       () => import('./views/post.js'));
  lazy('/messages',       () => import('./views/messages.js'));
  lazy('/messages/:id',   () => import('./views/messages.js'));
  lazy('/games',          () => import('./views/games.js'));
  lazy('/games/:key',     () => import('./views/game-play.js'));
  lazy('/clubs',          () => import('./views/clubs.js'));
  lazy('/clubs/:id',      () => import('./views/club.js'));
  lazy('/announcements',  () => import('./views/announcements.js'));
  lazy('/announcements/:id', () => import('./views/announcements.js'));
  lazy('/homework',       () => import('./views/homework.js'));
  lazy('/homework/:id',   () => import('./views/homework.js'));
  lazy('/leaderboard',    () => import('./views/leaderboard.js'));
  lazy('/profile',        () => import('./views/profile.js'));
  lazy('/profile/:username', () => import('./views/profile.js'));
  lazy('/notifications',  () => import('./views/notifications.js'));
  lazy('/settings',       () => import('./views/settings.js'));
  lazy('/admin',          () => import('./views/admin.js'));
  lazy('/admin/:section', () => import('./views/admin.js'));

  setNotFound(({ mount }) => {
    setPageTitle('Not found');
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'search',
      title: 'That page does not exist',
      text: 'The link may be old, or the page may have been removed.',
      action: '<a class="btn btn-primary" href="#/">Back to the home page</a>'
    })}</div>`;
  });
}

boot();
