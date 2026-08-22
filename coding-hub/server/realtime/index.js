import { Server } from 'socket.io';
import { get, all, run } from '../db/index.js';
import { verifyToken, loadUser, COOKIE } from '../lib/auth.js';
import { setIo, markOnline, markOffline, toUser, toConversation } from './hub.js';
import { userById } from '../lib/serialize.js';

function cookieValue(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Sets up the live layer: presence, typing indicators, message rooms and
 * game rooms. Every socket must present a valid session before it joins.
 */
export function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io'
  });
  setIo(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || cookieValue(socket.handshake.headers.cookie, COOKIE);
    const payload = token ? verifyToken(token) : null;
    if (!payload?.uid) return next(new Error('Please sign in first.'));
    const user = loadUser(payload.uid);
    if (!user || user.status !== 'active') return next(new Error('This account cannot connect.'));
    socket.data.user = { id: user.id, displayName: user.display_name, username: user.username };
    return next();
  });

  io.on('connection', (socket) => {
    const me = socket.data.user;
    socket.join(`user:${me.id}`);
    const firstConnection = !ioHasUser(io, me.id, socket.id);
    markOnline(me.id, socket.id);
    run("UPDATE users SET last_seen = datetime('now') WHERE id = ?", me.id);

    // Join every conversation room this member belongs to.
    for (const row of all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', me.id)) {
      socket.join(`conversation:${row.conversation_id}`);
    }

    if (firstConnection) io.emit('presence:online', { user: userById(me.id) });
    socket.emit('presence:ready', { userId: me.id });

    socket.on('conversation:join', (conversationId) => {
      const id = Number(conversationId);
      if (get('SELECT 1 AS x FROM conversation_members WHERE conversation_id = ? AND user_id = ?', id, me.id)) {
        socket.join(`conversation:${id}`);
      }
    });

    socket.on('typing:start', ({ conversationId }) => {
      const id = Number(conversationId);
      if (!get('SELECT 1 AS x FROM conversation_members WHERE conversation_id = ? AND user_id = ?', id, me.id)) return;
      socket.to(`conversation:${id}`).emit('typing', { conversationId: id, user: me, typing: true });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      const id = Number(conversationId);
      socket.to(`conversation:${id}`).emit('typing', { conversationId: id, user: me, typing: false });
    });

    socket.on('match:watch', (matchId) => {
      const match = get('SELECT * FROM game_matches WHERE id = ?', Number(matchId));
      if (match && (match.player_x === me.id || match.player_o === me.id)) {
        socket.join(`match:${match.id}`);
      }
    });

    socket.on('disconnect', () => {
      const wentOffline = markOffline(me.id, socket.id);
      run("UPDATE users SET last_seen = datetime('now') WHERE id = ?", me.id);
      if (wentOffline) io.emit('presence:offline', { userId: me.id });
    });
  });

  return io;
}

function ioHasUser(io, userId, exceptSocketId) {
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  if (!room) return false;
  for (const id of room) if (id !== exceptSocketId) return true;
  return false;
}
