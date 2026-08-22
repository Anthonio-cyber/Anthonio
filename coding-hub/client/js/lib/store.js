// ==========================================================
// A single shared place for the signed-in member, unread counts,
// live presence and socket events.
// ==========================================================
import { api } from './api.js';

const listeners = new Map();

export const store = {
  user: null,
  config: {
    siteName: 'Coding Hub',
    tagline: '',
    description: '',
    registrationMode: 'open',
    welcomeMessage: ''
  },
  unread: { messages: 0, notifications: 0 },
  online: new Set(),
  socket: null
};

/** Subscribe to an internal event. Returns an unsubscribe function. */
export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  for (const handler of listeners.get(event) || []) {
    try { handler(payload); } catch (err) { console.error(`[store] ${event}`, err); }
  }
}

export const can = (permission) => Boolean(store.user?.permissions?.includes(permission));

export function setUser(user) {
  store.user = user;
  applyTheme();
  emit('user', user);
}

export function applyTheme() {
  const theme = store.user?.theme || localStorage.getItem('codinghub-theme') || 'dark';
  const accent = store.user?.accent || localStorage.getItem('codinghub-accent') || 'violet';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
  localStorage.setItem('codinghub-theme', theme);
  localStorage.setItem('codinghub-accent', accent);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#080a13' : '#f4f5fb';
}

export async function refreshCounts() {
  if (!store.user) return;
  try {
    const [messages, notifications] = await Promise.all([
      api.messages.unread(),
      api.notifications.count()
    ]);
    store.unread.messages = messages.unread;
    store.unread.notifications = notifications.unread;
    emit('unread', store.unread);
  } catch { /* the badge simply stays as it was */ }
}

// ---------------------------------------------------------------------------
// The live connection
// ---------------------------------------------------------------------------
export async function connectRealtime() {
  if (store.socket || !store.user) return;
  const { io } = await import('/socket.io/socket.io.esm.min.js');

  const socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
  store.socket = socket;

  socket.on('connect', () => emit('socket:status', 'connected'));
  socket.on('disconnect', () => emit('socket:status', 'disconnected'));
  socket.on('connect_error', () => emit('socket:status', 'error'));

  socket.on('presence:online', ({ user }) => {
    if (user) store.online.add(user.id);
    emit('presence', { type: 'online', user });
  });
  socket.on('presence:offline', ({ userId }) => {
    store.online.delete(userId);
    emit('presence', { type: 'offline', userId });
  });

  socket.on('notification:new', ({ notification, unread }) => {
    store.unread.notifications = unread;
    emit('unread', store.unread);
    emit('notification', notification);
  });

  socket.on('message:new', (payload) => {
    emit('message:new', payload);
    if (payload.message?.senderId !== store.user.id) {
      store.unread.messages += 1;
      emit('unread', store.unread);
    }
  });
  socket.on('message:updated', (payload) => emit('message:updated', payload));
  socket.on('message:deleted', (payload) => emit('message:deleted', payload));
  socket.on('message:read', (payload) => emit('message:read', payload));
  socket.on('typing', (payload) => emit('typing', payload));
  socket.on('conversation:bump', (payload) => emit('conversation:bump', payload));


  socket.on('announcement:new', (payload) => emit('announcement:new', payload));

  socket.on('xp:changed', (payload) => {
    if (store.user) {
      store.user.xp = payload.xp;
      store.user.level = payload.level;
      store.user.levelTitle = payload.levelTitle || store.user.levelTitle;
      store.user.levelProgress = payload.progress;
      store.user.xpIntoLevel = payload.intoLevel;
      store.user.xpForNextLevel = payload.needed;
    }
    emit('xp', payload);
  });
}

export function disconnectRealtime() {
  store.socket?.disconnect();
  store.socket = null;
  store.online.clear();
}
