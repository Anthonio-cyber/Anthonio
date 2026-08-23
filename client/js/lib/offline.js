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
       ${pending ? `${pending} thing${pending === 1 ? '' : 's'} you wrote will be sent when you are back.` : ''}</span>`;
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
  return addToQueue({ kind: 'score', gameKey, score, result });
}

/** Remembers a post written with no connection. */
export function queuePost({ type = 'text', content = '', subject = '', clubId = null }) {
  return addToQueue({ kind: 'post', type, content, subject, clubId });
}

/** Remembers a comment written with no connection. */
export function queueComment(postId, content) {
  return addToQueue({ kind: 'comment', postId, content });
}

/** Remembers a message typed with no connection. */
export function queueMessage(conversationId, body) {
  return addToQueue({ kind: 'message', conversationId, body });
}

/** Remembers a homework tick made with no connection. */
export function queueHomeworkStatus(homeworkId, status) {
  return addToQueue({ kind: 'homework', homeworkId, status });
}

function addToQueue(entry) {
  const items = queue();
  items.push({ ...entry, at: Date.now(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  saveQueue(items);
  render();
  emit('queue:changed', { pending: items.length });
  return items.length;
}

export const pendingCount = () => queue().length;

/** Everything still waiting, so a screen can show it greyed out. */
export const pendingItems = () => queue();

/** Removes one waiting item (used when somebody cancels it). */
export function dropQueued(id) {
  saveQueue(queue().filter((item) => item.id !== id));
  render();
  emit('queue:changed', { pending: pendingCount() });
}

let flushing = false;

/**
 * Sends everything that was waiting, oldest first.
 * Anything the server rejects outright is dropped rather than retried
 * forever; anything that failed because the connection is still bad is kept.
 */
export async function flushQueue() {
  if (flushing) return 0;
  const items = queue();
  if (!items.length) return 0;

  flushing = true;
  const { api } = await import('./api.js');
  const left = [];
  const failed = [];
  let sent = 0;

  try {
    for (const item of items) {
      try {
        await sendOne(api, item);
        sent += 1;
      } catch (err) {
        // A connection problem means try again later; a refusal means give up.
        const connectionProblem = !err.status || err.status === 0 || err.status >= 500;
        if (connectionProblem) left.push(item);
        else failed.push({ item, reason: err.message });
      }
    }
  } finally {
    flushing = false;
  }

  saveQueue(left);
  render();
  if (sent) emit('queue:flushed', { sent });
  if (failed.length) emit('queue:rejected', { failed });
  return sent;
}

async function sendOne(api, item) {
  if (item.kind === 'score') {
    return api.games.submitScore(item.gameKey, item.score, item.result);
  }
  if (item.kind === 'post') {
    const data = new FormData();
    data.append('type', item.type);
    data.append('content', item.content);
    if (item.subject) data.append('subject', item.subject);
    if (item.clubId) data.append('clubId', item.clubId);
    return api.posts.create(data);
  }
  if (item.kind === 'comment') {
    return api.posts.comment(item.postId, item.content);
  }
  if (item.kind === 'message') {
    const data = new FormData();
    data.append('body', item.body);
    return api.messages.send(item.conversationId, data);
  }
  if (item.kind === 'homework') {
    return api.homework.setStatus(item.homeworkId, item.status, '');
  }
  throw Object.assign(new Error('Unknown item'), { status: 400 });
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
