// ==========================================================
// Offline support: registers the service worker, shows whether
// the class server can be reached, and keeps anything earned
// offline until it can be sent.
// ==========================================================
import { emit, on } from './store.js';
import { icon } from './icons.js';
import { esc } from './dom.js';

const QUEUE_KEY = 'g8h-pending';

export const offline = {
  online: navigator.onLine,
  serverReachable: true,
  usingSavedCopy: false,
  installPrompt: null
};

/** True when the app can actually talk to the class server. */
export const isLive = () => offline.online && offline.serverReachable;

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // If a new version of the app is waiting, use it on the next load.
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          emit('app:update-ready');
        }
      });
    });
    return registration;
  } catch (err) {
    console.warn('[offline] service worker could not be registered', err);
    return null;
  }
}

/** Wipes the saved class data from this device (used when signing out). */
export function clearOfflineData() {
  navigator.serviceWorker?.controller?.postMessage('clear-data');
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* storage may be full or blocked */ }
}

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------
export function startConnectionWatch() {
  const setState = (online) => {
    if (offline.online === online) return;
    offline.online = online;
    if (online) offline.serverReachable = true;
    render();
    emit('connection', { online: isLive() });
    if (isLive()) flushQueue();
  };

  window.addEventListener('online', () => setState(true));
  window.addEventListener('offline', () => setState(false));

  // The browser can report "online" while the class server is unreachable,
  // so check the server itself every so often.
  setInterval(async () => {
    if (!offline.online) return;
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const reachable = response.ok;
      if (reachable !== offline.serverReachable) {
        offline.serverReachable = reachable;
        render();
        emit('connection', { online: isLive() });
        if (reachable) flushQueue();
      }
    } catch {
      if (offline.serverReachable) {
        offline.serverReachable = false;
        render();
        emit('connection', { online: false });
      }
    }
  }, 20_000);

  render();
}

/** Marks that a screen is showing data saved earlier rather than live data. */
export function markSavedCopy(using) {
  if (offline.usingSavedCopy === using) return;
  offline.usingSavedCopy = using;
  render();
}

function render() {
  let bar = document.getElementById('offline-bar');
  const live = isLive();

  if (live && !offline.usingSavedCopy) {
    bar?.remove();
    document.body.classList.remove('is-offline');
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offline-bar';
    document.body.append(bar);
  }
  document.body.classList.toggle('is-offline', !live);

  const pending = queue().length;
  bar.className = `offline-bar ${live ? 'saved' : ''}`;
  bar.innerHTML = live
    ? `${icon('info', 15)}<span>Showing the last saved copy while the class server catches up.</span>`
    : `${icon('warning', 15)}<span>You are offline. Games still work, and you are seeing the last copy saved on this device.
       ${pending ? `${pending} score${pending === 1 ? '' : 's'} will be sent when you are back.` : ''}</span>`;
}

// ---------------------------------------------------------------------------
// Anything earned offline waits here until the server can be reached
// ---------------------------------------------------------------------------
function queue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

function saveQueue(items) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50))); } catch { /* storage full */ }
}

/** Remembers a game score played with no connection. */
export function queueScore(gameKey, score, result) {
  const items = queue();
  items.push({ kind: 'score', gameKey, score, result, at: Date.now() });
  saveQueue(items);
  render();
  return items.length;
}

export const pendingCount = () => queue().length;

/** Sends everything that was waiting, oldest first. */
export async function flushQueue() {
  const items = queue();
  if (!items.length) return 0;

  const { api } = await import('./api.js');
  const left = [];
  let sent = 0;

  for (const item of items) {
    if (item.kind !== 'score') continue;
    try {
      await api.games.submitScore(item.gameKey, item.score, item.result);
      sent += 1;
    } catch (err) {
      // Keep it for next time unless the server refused it outright.
      if (!err.status || err.status >= 500 || err.status === 0) left.push(item);
    }
  }

  saveQueue(left);
  render();
  if (sent) emit('queue:flushed', { sent });
  return sent;
}

// ---------------------------------------------------------------------------
// "Install this app"
// ---------------------------------------------------------------------------
export function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    offline.installPrompt = event;
    emit('install:available');
  });
  window.addEventListener('appinstalled', () => {
    offline.installPrompt = null;
    emit('install:done');
  });
}

export const canInstall = () => Boolean(offline.installPrompt);

export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: window-controls-overlay)').matches
  || window.navigator.standalone === true;

export async function promptInstall() {
  if (!offline.installPrompt) return 'unavailable';
  offline.installPrompt.prompt();
  const { outcome } = await offline.installPrompt.userChoice;
  if (outcome === 'accepted') offline.installPrompt = null;
  return outcome;
}
