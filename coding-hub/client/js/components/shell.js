// ==========================================================
// The application frame: sidebar, top bar, bottom navigation
// and the notification bell.
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { store, on, can, refreshCounts, applyTheme, disconnectRealtime } from '../lib/store.js';
import { api } from '../lib/api.js';
import { navigate, currentPath } from '../lib/router.js';
import { avatar } from './common.js';
import { toast, contextMenu } from '../lib/ui.js';
import { celebrate } from '../lib/celebrate.js';

const NAV = [
  { path: '/',              label: 'Dashboard',     icon: 'home',     mobile: true },
  { path: '/subjects',      label: 'Subjects',      icon: 'book',     mobile: true,
    also: ['/subject/', '/topic/', '/lesson/'] },
  { path: '/practice',      label: 'Practice',      icon: 'target',   mobile: true },
  { path: '/challenges',    label: 'Challenges',    icon: 'zap' },
  { path: '/progress',      label: 'My progress',   icon: 'chart' },
  { path: '/history',       label: 'History',       icon: 'clock' },
  { path: '/bookmarks',     label: 'Bookmarks',     icon: 'bookmark' },
  { path: '/achievements',  label: 'Achievements',  icon: 'award' },
  { path: '/leaderboard',   label: 'Leaderboard',   icon: 'trophy' },
  { path: '/messages',      label: 'Messages',      icon: 'message',  mobile: true, badge: 'messages' },
  { path: '/members',       label: 'Members',       icon: 'users' },
  { path: '/announcements', label: 'Announcements', icon: 'megaphone' },
  { path: '/profile',       label: 'Profile',       icon: 'user' },
  { path: '/notifications', label: 'Notifications', icon: 'bell', badge: 'notifications' },
  { path: '/settings',      label: 'Settings',      icon: 'settings' }
];

let shellRoot = null;

export function renderShell() {
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#/">
          <span class="brand-mark">&lt;/&gt;</span>
          <span class="brand-text">
            ${esc(store.config.siteName || 'Coding Hub')}
            <small>${esc(store.config.tagline || 'Learn to code')}</small>
          </span>
        </a>

        <nav class="nav-group" id="nav-main"></nav>

        <div class="sidebar-footer">
          <a class="sidebar-user" href="#/profile" id="sidebar-user"></a>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="icon-button" id="menu-toggle" aria-label="Open the menu" style="display:none">
            ${icon('menu', 20)}
          </button>
          <h1 id="page-title">Dashboard</h1>
          <div class="topbar-spacer"></div>
          <button class="icon-button" id="search-button" aria-label="Search" title="Search">
            ${icon('search', 19)}
          </button>
          <button class="icon-button" id="theme-toggle" aria-label="Switch between dark and light"></button>
          <button class="icon-button" id="bell-button" aria-label="Notifications">
            ${icon('bell', 19)}
            <span class="dot" id="bell-dot" hidden>0</span>
          </button>
          <button class="icon-button" id="account-button" aria-label="Your account">
            ${icon('user', 19)}
          </button>
        </header>

        <main id="view"></main>
      </div>
    </div>

    <nav class="bottom-nav">
      <div class="bottom-nav-inner" id="nav-mobile"></div>
    </nav>`;

  shellRoot = app;
  renderNav();
  renderSidebarUser();
  updateThemeButton();
  wireShell();
  refreshCounts();

  on('unread', renderBadges);
  on('user', () => { renderSidebarUser(); renderNav(); updateThemeButton(); });

  return document.getElementById('view');
}

function navItems() {
  const items = [...NAV];
  if (can('admin.access')) {
    items.splice(items.length - 1, 0, { path: '/admin', label: 'Admin Dashboard', icon: 'crown', admin: true });
  }
  return items;
}

function renderNav() {
  const path = currentPath().split('?')[0];
  const isActive = (item) => {
    if (item.path === '/') return path === '/';
    if (path.startsWith(item.path)) return true;
    return (item.also || []).some((prefix) => path.startsWith(prefix));
  };

  const main = document.getElementById('nav-main');
  if (main) {
    main.innerHTML = navItems().map((item) => `
      <a class="nav-item ${isActive(item) ? 'active' : ''} ${item.admin ? 'nav-admin' : ''}" href="#${item.path}">
        <span class="nav-icon">${icon(item.icon, 18)}</span>
        <span class="nav-text">${esc(item.label)}</span>
        ${item.badge ? `<span class="nav-badge" data-badge="${item.badge}" hidden>0</span>` : ''}
      </a>`).join('');
  }

  const mobile = document.getElementById('nav-mobile');
  if (mobile) {
    const items = navItems().filter((i) => i.mobile).slice(0, 4);
    mobile.innerHTML = `
      ${items.map((item) => `
        <a href="#${item.path}" class="${isActive(item) ? 'active' : ''}">
          ${icon(item.icon, 21)}
          <span>${esc(item.label)}</span>
          ${item.badge ? `<span class="nav-badge" data-badge="${item.badge}" hidden>0</span>` : ''}
        </a>`).join('')}
      <a href="#" id="more-toggle">
        ${icon('grid', 21)}
        <span>More</span>
      </a>`;
  }
  renderBadges();
}

function renderBadges() {
  for (const node of document.querySelectorAll('[data-badge]')) {
    const value = store.unread[node.dataset.badge] || 0;
    node.hidden = value === 0;
    node.textContent = value > 99 ? '99+' : value;
  }
  const dot = document.getElementById('bell-dot');
  if (dot) {
    const value = store.unread.notifications || 0;
    dot.hidden = value === 0;
    dot.textContent = value > 99 ? '99+' : value;
  }
}

function renderSidebarUser() {
  const node = document.getElementById('sidebar-user');
  if (!node || !store.user) return;
  node.innerHTML = `
    ${avatar(store.user, 'sm')}
    <span class="meta">
      <span class="name">${esc(store.user.displayName)}</span>
      <span class="sub">Level ${store.user.level} ${esc(store.user.levelTitle || '')} - ${store.user.xp} XP</span>
    </span>`;
}

function updateThemeButton() {
  const button = document.getElementById('theme-toggle');
  if (!button) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  button.innerHTML = icon(dark ? 'sun' : 'moon', 19);
  button.title = dark ? 'Switch to the light theme' : 'Switch to the dark theme';
}

function wireShell() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menu-toggle');

  const syncMenuButton = () => {
    toggle.style.display = window.innerWidth <= 900 ? 'grid' : 'none';
    if (window.innerWidth > 900) closeDrawer();
  };
  syncMenuButton();
  window.addEventListener('resize', syncMenuButton);

  function openDrawer() {
    sidebar.classList.add('open');
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.id = 'drawer-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    document.body.append(backdrop);
  }
  function closeDrawer() {
    sidebar.classList.remove('open');
    document.getElementById('drawer-backdrop')?.remove();
  }

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeDrawer();
    else openDrawer();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('#more-toggle')) {
      event.preventDefault();
      openDrawer();
      return;
    }
    if (event.target.closest('.sidebar a')) closeDrawer();
  });

  document.getElementById('theme-toggle').addEventListener('click', async () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (store.user) {
      store.user.theme = next;
      applyTheme();
      updateThemeButton();
      try { await api.users.updateMe({ theme: next }); } catch { /* saved locally anyway */ }
    }
  });

  document.getElementById('bell-button').addEventListener('click', () => navigate('/notifications'));
  document.getElementById('search-button').addEventListener('click', () => navigate('/search'));

  document.getElementById('account-button').addEventListener('click', async (event) => {
    const action = await contextMenu(event.currentTarget, [
      { label: 'My profile', action: 'profile', icon: 'user' },
      { label: 'Settings', action: 'settings', icon: 'settings' },
      ...(can('admin.access') ? [{ label: 'Admin dashboard', action: 'admin', icon: 'crown' }] : []),
      '-',
      { label: 'Sign out', action: 'logout', icon: 'logout', danger: true }
    ]);
    if (action === 'profile') navigate('/profile');
    if (action === 'settings') navigate('/settings');
    if (action === 'admin') navigate('/admin');
    if (action === 'logout') await signOut();
  });

  window.addEventListener('hashchange', () => {
    renderNav();
    // Any route change closes the mobile drawer, including the back button.
    closeDrawer();
  });

  // Levelling up and unlocking a badge are worth more than a toast.
  on('xp', (payload) => {
    if (payload.levelUp) {
      celebrate({
        title: `Level ${payload.level}!`,
        subtitle: payload.levelTitle ? `You are now a ${payload.levelTitle}` : '',
        duration: 3200
      });
    }
  });

  on('notification', (notification) => {
    if (notification.kind === 'badge') {
      celebrate({ title: 'Badge unlocked!', subtitle: notification.title.replace(/^Badge unlocked: /, ''), duration: 3200 });
      return;
    }
    if (currentPath().startsWith('/notifications')) return;
    toast(notification.title, 'info');
  });
}

export async function signOut() {
  try { await api.auth.logout(); } catch { /* the cookie is cleared anyway */ }
  disconnectRealtime();
  store.user = null;
  window.location.hash = '#/login';
  window.location.reload();
}

export function setPageTitle(text) {
  const node = document.getElementById('page-title');
  if (node) node.textContent = text;
  document.title = `${text} - ${store.config.siteName || 'Coding Hub'}`;
}
